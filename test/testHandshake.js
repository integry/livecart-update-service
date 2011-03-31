var fc = new (require('../server.js').fc);
var cgi = fc.process.bind(fc);
var httputil = require('nodeunit').utils.httputil;

exports.testInvalidHandshake = function(test)
{
	httputil(cgi, function(server, client)
	{
		client.fetch('GET', '/handshake', {}, function (resp)
		{
			test.equal('Domain name missing', resp.body);
			server.close();
			test.done();
		});
	});
};

exports.testInvalidDomain = function(test)
{
	httputil(cgi, function(server, client)
	{
		client.fetch('GET', '/handshake?domain=localhost', {}, function (resp)
		{
			test.equal('Domain name missing', resp.body);
			server.close();
			test.done();
		});
	});
};
