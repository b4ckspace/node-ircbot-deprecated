var LOGGER;
var CONFIG;

var MODULE_NAME = "AUTOVOICE";


var util = require("util");
var bot_;

// Normalize nickname for better matching
function normalizeNick(nick) {
    return nick.replace(/[^a-zA-Z]+/, '').toLowerCase();    
}

function inSpace(username){

    // Checks if the username is currently in space, and exits
    // the loop if so
    return bot_._bckspcapi.getMembers().some(function(value, key) {
        if(normalizeNick(value) == normalizeNick(username)) {
            return true;
        }
    });
};

function setAllChans() {
    for(var channel in bot_.topics){ 
        setVoices('#backspace');    
        break;
    }
}

var setVoices = function(channel){

    bot_.irc_client.once('names', function(chname, names){

        if(channel != chname){
            LOGGER.debug("setVoice channel!=nchannel %s != %s", channel, chname);
            return;
        }

        // Iterate all names inside the channel and check if the nick is voiced or not
        for(var username in names) {

            var is_voiced = (names[username].indexOf("+") != -1);
            var in_space = inSpace(username);
            
            // Check if user is voiced but not in space anymore
            if(is_voiced && !in_space) {
                LOGGER.debug("user has voice, but not in space: %s", username);
                bot_.irc_client.send('mode', channel, '-v', username);
            }

            // Check if user is not voiced, but in space
            if(!is_voiced && in_space) {
                LOGGER.debug("user has no voice, but in space: %s", username);
                bot_.irc_client.send('mode', channel, '+v', username);
            }
        }

    });

    bot_.irc_client.send('names', channel);
};

module.exports = function(cfg, log, bot){

    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    bot_   = bot;

    bot.irc_client.on('join', function(channel, nick, message){
        LOGGER.debug("user %s joined chanel", nick, channel);
        setVoices(channel);
    });

    bot._bckspcapi.on('start', function(){
        LOGGER.debug('api is ready!');
        setAllChans();
    });

    bot._bckspcapi.on('join', function(member){
        LOGGER.debug('member join: %s', member);
        setAllChans();
    });

    bot._bckspcapi.on('part', function(member){
        LOGGER.debug('member part: %s', member);
        setAllChans();
    });

    bot.irc_client.on('+mode', function(channel, by, mode, arg, msg){
        if(mode!='o'){
            LOGGER.debug('got op +modechange: %s, %s, %s, %s, %s', channel, by, mode, arg, msg);
            return;
        }
        LOGGER.debug('+modechange: %s, %s, %s, %s, %s', channel, by, mode, arg, msg);
        // setVoices(channel);
    });

    // bot.irc_client.on('-mode', function(channel, by, mode, arg, msg){
    //     if(by==bot.nick)
    //         return;
    //     LOGGER.debug('-modechange: %s, %s, %s, %s, %s', channel, by, mode, arg, msg);
    //     setVoices(channel);
    // });

    bot.irc_client.on('nick', function(oldnick, newnick, channels){
        LOGGER.debug('nickchange: %s -> %s', oldnick, newnick);
        for(i in channels){
            setVoices(channels[i]);
        }
    });

};

