Strophe.WebSocket = function(service)
 {
    // Connection
    this.connection = null;
    this.service = service;

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
            this.connection = connection;
            this.socket = new WebSocket(this.service, "xmpp");
            this.socket.onopen = this._onOpen.bind(this);
            this.socket.onerror = this._onError.bind(this);
            this.socket.onclose = this._onClose.bind(this);
            this.socket.onmessage = this._onMessage.bind(this);
        }
    },
    
    /** Function: reset
     *  Reset WebSocket
     */
    reset: function()
    {
    },

    /** Function disconnect 
	 *  Disconnects from the server
	 */
    disconnect: function() {
        this.connection.xmlOutput(this._endStream());
        this.connection.rawOutput(this._endStream());
        this.socket.send(this._endStream())
        this.socket.close();
        // Close the socket
    },

    /** Function _doDisconnect 
	 *  Finishes the connection. It's the last step in the cleanup process.
	 */
    _doDisconnect: function() {
        this.socket = null;
        // Makes sure we delete the socket.
    },

    /** Function send 
	 *  Sends messages
	 */
    send: function(msg) {
        this.connection.xmlOutput(msg);
        this.connection.rawOutput(Strophe.serialize(msg));
        this.socket.send(Strophe.serialize(msg));
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
        Strophe.log("Websocket error " + error)
    },

    /** PrivateFunction: _onOpen
     *  _Private_ function to handle websockets connections.
     *
     */
    _onOpen: function() {
        Strophe.log("Websocket open")
        this.connection.xmlOutput(this._startStream());
        this.connection.rawOutput(this._startStream());
        this.socket.send(this._startStream());
    },

    /** PrivateFunction: _onClose
     *  _Private_ function to handle websockets closing.
     *
	 */
    _onClose: function(event) {
        Strophe.log("Websocket disconnected")
        this.connection._doDisconnect()
    },

    /** PrivateFunction: _onError
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
        var string = message.data.replace("<stream:features>", "<stream:features xmlns:stream='http://etherx.jabber.org/streams'>"),
        string = string.replace("<stream:error>", "<stream:error xmlns:stream='http://etherx.jabber.org/streams'>"),
        elem = Strophe.xmlHtmlNode(string).documentElement;

        this.connection.xmlInput(elem);
        this.connection.rawInput(Strophe.serialize(elem));
        console.log(elem.nodeName);

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
    
    authenticationNotFound: function(callback) {
    },
    
    _connect_cb: function (elem, _callback)
    {
        this.connection._connect_cb(elem);
    },

    _startStream: function() {
        return "<stream:stream to='" + this.connection.domain + "' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0' />";
    },

    _endStream: function() {
        return "</stream:stream>";
    }

};
	
