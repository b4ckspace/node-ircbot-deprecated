var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "MPD";

var util        = require('util');
var mpdSocket   = require('mpdsocket');

/*MPD SETTINGS*/
var mpd_host    = '10.1.20.5';
var mpd_port    = '6600';
var music_baseurl   = "ftp://nfs/music/";
var mpd;

(COMMANDS['!np'] = function(sender, to){
    var that=this;
    try{
        mpd.send('currentsong',function(info) {
            if(!info['_OK']){
                LOGGER.error('np mpc not ok: ' + util.inspect(info));
                that.reply(sender, to, "mpd error :(");
                return;
            }
            var premium  = /http.*\?[0-9a-f]*/g;
            var filename = info['file'] ? info['file'].replace(premium, "premiumstream") : "";
            var artist   = info['Artist'] ? info['Artist'] + " - " : "";
            var message  =   "now playing: " + artist + info['Title'];
            if((artist=="") || (info['Title']=="")){
                message = message + '(' + filename + ')';
            }
            if( !info['Artist'] && !info['Title']){
                message  = "now playing: " + filename;
            }
            that.reply(sender, to, message);
        });
    }catch(e){
        that.reply(sender, to, "mpd error :(");
        LOGGER.error('np exception' + util.inspect(e));
    }
}).helptext = "now playing.";

(COMMANDS['!addstream'] = function(sender, to, media){
    if(!media){
        LOGGER.debug("no stream url %s, %s", %s, %s);
        this.reply(sender, to, "stream url needed!");
        return;
    }
    var that = this;
    try{
        mpd.send( ('add ' + media), function(info) {
            if(info._OK){
                that.reply(sender, to, "added " + media + " to playlist");
                LOGGER.info("addstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
            }else{
                LOGGER.error("addstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                that.reply(sender, to, "error adding item to playlist :(");
            }
        });
    }catch(e){
        that.reply(sender, to, "error adding item to playlist :(");
        LOGGER.error("addstream exception: " + util.inspect(e));
    }
}).helptext = "adds the stream to the mpd playlist.";

(COMMANDS['!playstream'] = function(sender, to, media){
    if(!media){
        LOGGER.debug("no stream url %s, %s", %s, %s);
        this.reply(sender, to, "stream url needed!");
        return;
    }
    var that = this;
    try{
        mpd.send( ('addid ' + media), function(info) {
            if(info._OK){
                mpd.send( ('playid ' + info.Id), function(info) {
                    if(info._OK){
                        LOGGER.info("playstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                        that.reply(sender, to, "playing " + media);
                    }else{
                        LOGGER.error("playstream s2 user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                        that.reply(sender, to, "error playing item:(");
                    }
                });
            }else{
                LOGGER.error("playstream s1 user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                that.reply(sender, to, "error playing item:(");
            }
        });
    }catch(e){
        this.reply(sender, to, "error playing item :(");
        LOGGER.error("playstream exception user:" + sender + " stream: " + media + " mpd: " + util.inspect(e));
    }
}).helptext = "play the given stream.";

(COMMANDS['!add'] = function(sender, to){
    var args = Array.prototype.slice.call(arguments);
    var term = args.slice(2).join(' ');
    if(!term){
        LOGGER.debug("no searchterm url %s, %s", %s, %s);
        this.reply(sender, to, "search term needed!");
        return;
    }
    LOGGER.info("search term: " + term);
    var that = this;
    try{
        mpd.send('search any "' + term + '"', function(response){
            if(response['file']){ //if file is set, the response is no list
                mpd.send( ('add "' + response['file'] + '"'), function(info) {
                    LOGGER.info("add to playlist " + util.inspect(info));
                    that.reply(sender, to, 'added "'+response['file']+'" to playlist.');
                });
            }else if (response["_ordered_list"]){
                that.reply(sender, to, "no unique file found, specify your search and try again.");
            }else{
                that.reply(sender, to, "nothing found :(");
            }
        });
    }catch(e){
        this.reply(sender, to, "error adding item :(");
        LOGGER.error("add exception user:" + sender + " term: " + term + " mpd: " + util.inspect(e));
    }
}).helptext = "add the song matching the searchterm to the playlist.";

(COMMANDS['!npfile'] = function(sender, to){
    var that = this;
    try{
        mpd.send('currentsong',function(response) {
            that.reply(sender, to, music_baseurl + encodeURIComponent(response['file']));
        });
    }catch(e){
        this.reply(sender, to, "error getting file :(");
        LOGGER.error("npfile exception user:" + sender + " term: " + term + " mpd: " + util.inspect(e));
    }
}).helptext = "get the path to the current playing file";


module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }
    mpdInit();
    return {commands:COMMANDS};
};


var mpdInit = function(){
    var reconnect = false;
    LOGGER.debug("reconnect");
    mpd = new mpdSocket(mpd_host, mpd_port);
    mpd.on('close', function(){
        LOGGER.debug("close");
        if(!reconnect){
            reconnect=true;
            setTimeout(mpdInit, 5000);
        }
    });
    mpd.on('error', function(text){
        LOGGER.error(text);
        if(!reconnect){
            reconnect=true;
            setTimeout(mpdInit, 5000);
        }
    });
};