var LOGGER;
var CONFIG;
var MODULE_NAME = "SENTRY";


var raven = require('raven');


module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    var client = new raven.Client(cfg.raven_url);
    client.patchGlobal();
    var lf = bot._log_factory;
    var oldfun = lf.getLogger;
    lf.getLogger = function(component){
        var logger = oldfun.apply(lf, Array.prototype.slice.call(arguments));
        var olderror = logger.error;
        logger.error = function(message){
            client.captureException(new Error(message), {tags: { component: component }});
            return olderror.apply(logger, Array.prototype.slice.call(arguments));
        };
        return logger;
    };
    return {commands:[]};
};
