;( function( W ) {

  var CM = W.CM = W.CM || {};

  CM.Transport = CM.Transport || {};

  CM.Transport.RTCTransport = new Class({

    Extends: CM.Transport,

    Implements: [ CM.Transport.RTCInternals ],

    options: {
      stun: {
        iceServers: [
          {
            url: "stun:stun.l.google.com:19302"
          }
        ]
      },
      mediaSettings: {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      }
    },

    initialize: function( session, options ) {
      this.parent( session, options );
      this.peerConnection = null;
      this.candidates = [];
      this.setLocalStream( null );
      this.setInited( false );
    },

    isInited: function() {
      return this._inited;
    },

    setInited: function( inited ) {
      this._inited = inited;
    },

    connect: function( callback, errback ) {
      var self = this,
          localCallback = function() {
            try {
              self.candidates = [];
              var pc = new RTCPeerConnection(
                self.options.stun
              );
              pc.onopen = function() {
                var args = CM.argsToArr( arguments );
                args.shift();
                self.bang( 'rtc.connection.open', args );
                if ( CM.isFunc( callback ) ) {
                  callback.apply( self, args );
                }
              }
              pc.onconnecting = function() {
                self.bang( 'rtc.connection.connecting', arguments );
              }
              pc.onicecandidate = function( event ) {
                if ( !CM.isEmpty( event.candidate ) ) {
                  self.scheduleOfferCandidate( {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                  } );
                  self.bang( 'rtc.connection.icecandidate', event );
                }
              }
              pc.onaddstream = function( stream ) {
                var args = CM.argsToArr( arguments );
                args.shift();
                self.bang( 'rtc.connection.addstream', args );
              }
              pc.onremovestream = function() {
                var args = CM.argsToArr( arguments );
                args.shift();
                self.bang( 'rtc.connection.removestream', args ); 
              }
              self.peerConnection = pc;
              self.setInited( true );
            } catch ( e ) {
              self.bang( 'rtc.error' );
              self.setInited( false );
              if ( CM.isFunc( errback ) ) {
                errback.call( self, e );
              }
            }
          };
      if ( !CM.isEmpty( this.peerConnection ) ) {
        this.disconnect( localCallback );
      } else {
        localCallback();
      }
    },

    disconnect: function( callback ) {
      try {
        if ( !CM.isEmpty( this.peerConnection ) ) {
          this.peerConnection.close();
          this.peerConnection = null;
          this.candidates = [];
          this.setInited( false );
          this.setLocalStream( null );
        }
        this.bang( 'rtc.close.ok', e );
        if ( CM.isFunc( callback ) ) {
          callback();
        }
      } catch ( e ) {
        this.bang( 'rtc.close.error', e );
      }
    },

    scheduleOfferCandidate: function( candidate ) {
      this.candidates.push( candidate );
      if ( this.isInited() ) {
        this.offerCandidates();
      }
    },

    offerCandidates: function() {
      var self = this;
      while( this.candidates.length ) {
        candidate = this.candidates.shift();
        this.session.offerCandidate( candidate );
      }
    },

    setLocalStream: function( stream ) {
      this._localStream = stream;
    },

    offer: function( callback, errback ) {
      
      var self = this;

      if ( !this.isInited() ) {
        this.connect( function() {
          self.offer.call( self, callback, errback );
        }, errback );
      }

      if ( CM.isEmpty( this._localStream ) ) {
        this.session.getLocalStream( function() {
          self.offer.call( self, callback, errback );
        }, errback );
      }

      this.peerConnection.addStream( this._localStream );
      this.peerConnection.createOffer(
        function( sessDescr ) {
          sessDescr.sdp = self.preferOpus( sessDescr.sdp );
          self.peerConnection.setLocalDescription( sessDescr );
          if ( CM.isFunc( callback ) ) {
            callback.call( self, sessDescr );
          }
        },
        null,
        this.options.mediaSettings
      );
    },

    answer: function( remoteSess, callback, errback ) {
      var self = this;

      if ( !this.isInited() ) {
        this.connect( function() {
          self.answer.call( self, remoteSess, callback, errback );
        }, errback );
      }

      if ( CM.isEmpty( this._localStream ) ) {
        this.session.getLocalStream( function() {
          self.answer.call( self, remoteSess, callback, errback );
        }, errback );
      }

      this.peerConnection.setRemoteDescription(
        new RTCSessionDescription( remoteSess )
      );

      this.peerConnection.addStream( this._localStream );

      this.peerConnection.createAnswer(
        function( sessDescr ) {
          sessDescr.sdp = self.preferOpus( sessDescr.sdp );
          self.peerConnection.setLocalDescription( sessDescr );
          if ( CM.isFunc( callback ) ) {
            callback.call( self, sessDescr );
          }
        },
        null,
        this.options.mediaSettings
      );
    },

    finalizeWith: function( remoteSess ) {
      this.peerConnection.setRemoteDescription(
        new RTCSessionDescription( remoteSess )
      );
      this.offerCandidates();
    }

  });

} )( window );