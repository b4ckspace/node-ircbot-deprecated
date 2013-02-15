var LOGGER;
var CONFIG;
var MODULE_NAME = "SENTRY";


var raven = require('raven');


module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    var client = new raven.Client(cfg.raven_url);
    client.patchGlobal();
    return {commands:[]};
};
