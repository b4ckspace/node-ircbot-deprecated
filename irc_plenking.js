var plenkers={};
var logger;
var config;
var plenkingWait    = 30*60*1000;//30min
var filters = {
    plenking :  function(message, sender, to){
                    var expr = /\s{2,}/g ;
                    var hits = message.match(expr);
                    if( hits && (hits.length>=2) ){
                        logger.info("plenking detected user: " + sender);
                        if(plenkers[sender]){
                            logger.warn("kicking user: " + sender + " from channel " + to);
                            this.rc_client.send("kick", to, sender, "plenking");
                        }else{
                            this.reply(sender, to, "bitte hier kein plenking.");
                            plenkers[sender] = true;
                            setTimeout(function(){
                                plenkers[sender] = undefined;
                                logger.info("plenking cleared for user " + sender);
                            },plenkingWait);
                        }  
                    }
                }, 
    };

module.exports = function(cfg, log, bot){
    logger = log.getLogger("plenking");
    config = cfg;
    for(key in filters){
        bot.filters[key] = filters[key];
    }
};