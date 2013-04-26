Strophe.WebSocket = function(service)
 {
    // Connection
    this.connection = null;
    this.service = service;

    this._keepAliveTimer = 20000;

    // Requests stack.
    this._requests = [];
};

Strophe.WebSocket.prototype = {

    /** Function connect
     *  Connects to the server using websockets.
     *  It also assigns the connection to this proto
     */
    connect: function(connection) {
        if (!this.socket) {
            try {
                this.connection = connection;
                this._openWebsocket();
            } catch(e) {
                Strophe.log(e);
            }
        }
    },

    _openWebsocket: function(onMessageCallback){
        var ws = 'MozWebSocket' in window ? window.MozWebSocket : window.WebSocket;
        this.socket = new ws(this.service, "xmpp");
        this.socket.onopen = this._onOpen.bind(this);
        this.socket.onerror = this._onError.bind(this);
        this.socket.onclose = this._onClose.bind(this);
        this.socket.onmessage = onMessageCallback ? onMessageCallback.bind(this) : this._onMessage.bind(this);

        this.connection._addSysTimedHandler(this._keepAliveTimer, this._keepAliveHandler.bind(this));
    },

    /** Function: reset
     *  Reset WebSocket
     */
    reset: function() {
        this.socket = null;
    },

    flush: function() {
    },

    /** Function disconnect
     *  Disconnects from the server
     */
    disconnect: function() {
        this.connection.xmlOutput(this._endStream());
        this.connection.rawOutput(this._endStream());
        if (this.socket && this.socket.readyState !== this.socket.CLOSED) {
            this.socket.send(this._endStream());
            // Close the socket
            this.socket.close();
        }
    },

    /** Function _doDisconnect
     *  Finishes the connection. It's the last step in the cleanup process.
     */
    _doDisconnect: function() {
        if (this.socket && this.socket.readyState != this.socket.CLOSED) {
            this.socket.close();
        }
        // Makes sure we delete the socket.
        this.socket = null;
    },

    _keepAliveHandler: function() {
        this.socket.send("\n");
        return true;
    },

    /** Function send
     *  Sends messages
     */
    send: function(msg) {
        try {
            this.connection.xmlOutput(msg);
            this.connection.rawOutput(Strophe.serialize(msg));
            this.socket.send(Strophe.serialize(msg));

            clearTimeout(this._idleTimeout);
            this._idleTimeout = setTimeout(this._onIdle.bind(this), 100);
        } catch(e) {
            Strophe.error(e);
        }
    },

    /** Function: restart
     *  Send an xmpp:restart stanza.
     */
    restart: function() {
        this.connection.xmlOutput(this._startStream());
        this.connection.rawOutput(this._startStream());
        this.socket.send(this._startStream());
    },

    /** PrivateFunction: _onError
     *  _Private_ function to handle websockets errors.
     *
     *  Parameters:
     *    () error - The websocket error.
     */
    _onError: function(error) {
        Strophe.error("Websocket error: " + error);
    },

    /** PrivateFunction: _onOpen
     *  _Private_ function to handle websockets connections.
     *
     */
    _onOpen: function() {
        Strophe.log("Websocket open");
        this.connection.xmlOutput(this._startStream());
        this.connection.rawOutput(this._startStream());
        this.socket.send(this._startStream());
    },

    /** PrivateFunction: _onClose
     *  _Private_ function to handle websockets closing.
     *
     */
    _onClose: function(event) {
        Strophe.log("Websocket disconnected");
        // check if we're still using websocket protocol and not some fancy fallback mechanism has chosen another one
        if (this.connection.protocol instanceof Strophe.WebSocket) {
            this.connection._doDisconnect();
            // in case the connection hasn't been setup correctly yet and therefore the check in _doDisconnect with this.connected fails
            this.connection._changeConnectStatus(Strophe.Status.DISCONNECTED);
        }
    },

    /** PrivateFunction: _onMessage
     *  _Private_ function to handle websockets messages.
     *
     *  This function parses each of the messages as if they are full documents. [TODO : We may actually want to use a SAX Push parser].
     *
     *  Since all XMPP traffic starts with "<stream:stream version='1.0' xml:lang='en' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' id='3697395463' from='SERVER'>"
     *  The first stanza will always fail to be parsed...
     *  Addtionnaly, the seconds stanza will always be a <stream:features> with the stream NS defined in the previous stanza... so we need to 'force' the inclusion of the NS in this stanza!
     *
     *  Parameters:
     *    (string) message - The websocket message.
     */
    _onMessage: function(message) {
        // Ugly hack to deal with the problem of stream ns undefined,
        if (message.data === "</stream:stream>") {
            var close = "</stream:stream>";
            this.connection.rawInput(close);
            this.connection.xmlInput(document.createElement("stream:stream"));
            if (!this.connection.disconnecting) {
                this.connection._doDisconnect();
            }
            return;
        }
        var elem = this._prepareAndLogMessage(message);
        if (elem.nodeName == "stream:stream") {
            // Let's just skip this.
        }
        else if(elem.nodeName == "stream:features" && !this.connection.connected) {
            this._connect_cb(elem, this._connect_cb);
        }
        else {
            this.connection.receiveData(elem);
        }
    },

    _prepareAndLogMessage: function (message) {
        var string = message.data.replace(/<stream:([a-z]*)>/, "<stream:$1 xmlns:stream='http://etherx.jabber.org/streams'>");
        string = string.replace(/<stream:stream (.*[^\/])>/, "<stream:stream $1/>");
        var elem = Strophe.xmlHtmlNode(string).documentElement;

        this.connection.xmlInput(elem);
        this.connection.rawInput(Strophe.serialize(elem));
        return elem;
    },

    authenticationNotFound: function(callback) {
    },

    _connect_cb: function (elem, _callback)
    {
        this.connection._connect_cb(elem);
    },

    _onIdle: function() {

    },

    _startStream: function() {
        return "<?xml version='1.0'?><stream:stream to='" + this.connection.domain + "' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0'  xml:lang='en' xmlns:xml='http://www.w3.org/XML/1998/namespace'>";
    },

    _endStream: function() {
        return "</stream:stream>";
    }

};
