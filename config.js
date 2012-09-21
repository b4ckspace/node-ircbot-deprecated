/* copy this file to config.local.js and set it to correct values */

var env=process.env;

exports.nick        = env['nick']       || 'b4ckspace_bot';
exports.realname    = env['realname']   || 'b4ckspace_bot';
exports.username    = env['username']   || 'b4ckspace_bot';
exports.irc_server  = env['irc_server'] || 'irc.freenode.net';
exports.irc_port    = env['irc_port']   || 6667;
exports.ircpass     = env['irc_pass']   || undefined;
exports.secure      = env['irc_ssl']    == "true";
exports.ignoreSsl   = env['ssl_ignore'] == "true";
exports.channels    = (env['channels']  && env['channels'].split(','))||['#backspace'];
exports.disable_mpd = env['nompd']      == "true";
