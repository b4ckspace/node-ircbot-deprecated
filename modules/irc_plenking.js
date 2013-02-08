var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "PLENKING";

var plenkers={};
var plenkingWait    = 30*60*1000;//30min

FILTERS.plenking = function(message, sender, to){
    var expr = /\s{2,}/g ;
    var hits = message.match(expr);
    if( hits && (hits.length>=2) ){
        LOGGER.info("plenking detected user: " + sender);
        if(plenkers[sender]){
            LOGGER.warn("kicking user: " + sender + " from channel " + to);
            this.irc_client.send("kick", to, sender, "plenking");
        }else{
            this.reply(sender, to, "bitte hier kein plenking.");
            plenkers[sender] = true;
            setTimeout(function(){
                plenkers[sender] = undefined;
                LOGGER.info("plenking cleared for user " + sender);
            },plenkingWait);
        }
    }
};

module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }
    return {commands:COMMANDS};
};