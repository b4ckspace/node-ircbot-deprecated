var http            = require('http');
var EventEmitter    = require('events').EventEmitter;

var bckspcApi = function bckspcApi(){
    this.fetchTimer = 30000;
    this.lastStatus = null;
    this.lastMembers = [];
    this.updateSpaceStatus();
};

bckspcApi.prototype = EventEmitter.prototype;

bckspcApi.prototype.lastStatusData = null;

bckspcApi.prototype.updateSpaceStatus = function(){
    var options = {
        host: 'status.bckspc.de',
        port: 80,
        path: '/status.php?response=json'
    };
    var that=this;
    http.get(options, function(res) {
        var resString = '';

        res.setEncoding('utf8');

        res.on( 'data', function( data ) {
            resString += data;
        } );

        res.on('end', function(){
            var status;
            try {
                status = JSON.parse(resString);
            }
            catch( e ) {
                console.log( 'json parsing error: ' + e.message );
                return;
            }
            that.updateMembers(status.members_present);

            if(!that.lastStatus){
                that.lastStatus = status;
                that.emit('ready', that.isOpen());
                return;
            }
            if(status['members'] != that.lastStatus['members']){
                that.emit('membercount', status['members']);
                console.log("emit membercount" + status['members']);
            }
            var wasopen = that.isOpen();
            that.lastStatus = status;
            var nowopen = that.isOpen();
            if( (!wasopen) && (nowopen) ){
                console.log("emit open, isopen true");
                that.emit('isopen', true);
                that.emit('open');
            }
            if( (wasopen) && (!nowopen) ){
                console.log("emit closed, isopen false");
                that.emit('isopen', false);
                that.emit('closed');
            }


        });
    }).on('error', function(e) {
        console.log("Got http status error error: " + e.message);
    });
    setTimeout(function(){
        that.updateSpaceStatus();
    }, this.fetchTimer);
};

bckspcApi.prototype.isReady = function(){
    return this.lastStatus != null;
};

bckspcApi.prototype.isOpen = function(){
    return this.lastStatus && this.lastStatus['members'] > 0;
};

bckspcApi.prototype.openCount = function(){
    return this.lastStatus && this.lastStatus['members'];
};

bckspcApi.prototype.updateMembers = function(members){
    var nicks = members.map(function(member){return member.nickname});

    if(!this.isReady()){ // don't emit new members on api start
        this.lastMembers = nicks;
        return;
    }

    for(var i in nicks){
        if(this.lastMembers.indexOf(nicks[i]) == -1 ){
            console.log('emit join %s', nicks[i]);
            this.emit('join', nicks[i]);
        }
    }

    for(var i in this.lastMembers){
        if(nicks.indexOf(this.lastMembers[i]) == -1 ){
            console.log('emit part %s', this.lastMembers[i]);
            this.emit('part', this.lastMembers[i]);
        }
    }
    this.lastMembers = nicks;
};

bckspcApi.prototype.getMembers = function(){
    return this.lastMembers;
};


module.exports = bckspcApi;
