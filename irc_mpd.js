var util        = require('util');
var commands = {};
var l_mpd;
var config;
/*MPD SETTINGS*/
var mpd_host    = '10.1.20.5';
var mpd_port    = '6600';
var music_baseurl   = "ftp://nfs/music/";
var mpd;
var mpdSocket   = require('mpdsocket');




(commands['!np'] = function(sender, to){
    var that=this;
    try{
        mpd.send('currentsong',function(info) {
            if(!info['_OK']){
                l_mpd.error('np mpc not ok: ' + util.inspect(info));
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
        l_mpd.error('np exception' + util.inspect(e));
    }
}).helptext = "now playing.";

(commands['!addstream'] = function(sender, to, media){
    var that = this;
    try{
        mpd.send( ('add ' + media), function(info) {
            if(info._OK){
                that.reply(sender, to, "added " + media + " to playlist");
                l_mpd.info("addstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
            }else{
                l_mpd.error("addstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                that.reply(sender, to, "error adding item to playlist :(");
            }
        });
    }catch(e){
        that.reply(sender, to, "error adding item to playlist :(");
        l_mpd.error("addstream exception: " + util.inspect(e));
    }
}).helptext = "adds the stream to the mpd playlist.";

(commands['!playstream'] = function(sender, to, media){
    var that = this;
    try{
        mpd.send( ('addid ' + media), function(info) {
            if(info._OK){
                mpd.send( ('playid ' + info.Id), function(info) {
                    if(info._OK){
                        l_mpd.info("playstream user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                        that.reply(sender, to, "playing " + media);
                    }else{
                        l_mpd.error("playstream s2 user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                        that.reply(sender, to, "error playing item:(");
                    }
                });
            }else{
                l_mpd.error("playstream s1 user:" + sender + " stream: " + media + " mpd: " + util.inspect(info));
                that.reply(sender, to, "error playing item:(");
            }
        });
    }catch(e){
        this.reply(sender, to, "error playing item :(");
        l_mpd.error("playstream exception user:" + sender + " stream: " + media + " mpd: " + util.inspect(e));
    }
}).helptext = "play the given stream.";

(commands['!add'] = function(sender, to){
    var args = Array.prototype.slice.call(arguments);
    var term = args.slice(2).join(' ');
    l_mpd.info("search term: " + term);
    var that = this;
    try{
        mpd.send('search any "' + term + '"', function(response){
            if(response['file']){ //if file is set, the response is no list
                mpd.send( ('add "' + response['file'] + '"'), function(info) {
                    l_mpd.info("add to playlist " + util.inspect(info));
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
        l_mpd.error("add exception user:" + sender + " term: " + term + " mpd: " + util.inspect(e));
    }
}).helptext = "add the song matching the searchterm to the playlist.";

(commands['!npfile'] = function(sender, to){
    var that = this;
    try{
        mpd.send('currentsong',function(response) {
            that.reply(sender, to, music_baseurl + encodeURIComponent(response['file']));
        });
    }catch(e){
        this.reply(sender, to, "error getting file :(");
        l_mpd.error("npfile exception user:" + sender + " term: " + term + " mpd: " + util.inspect(e));
    }
}).helptext = "get the path to the current playing file";

module.exports = function(cfg, logger, bot){
    l_mpd = logger.getLogger("mpd");
    config=cfg;
    /* MPD SETUP*/
    var mpdInit = function(){
        l_mpd.debug("reconnect");
        mpd = new mpdSocket(mpd_host, mpd_port);
        mpd.on('close', function(){
            l_mpd.debug("close");
            mpdInit();
        });
        mpd.on('error', function(text){
            l_mpd.error(text);
            setTimeout(mpdInit, 5000);
        });
    };
    mpdInit();
    for(key in commands){
        bot.commands[key] = commands[key];
    }
};