var fc = new (require('../server.js').fc);
var cgi = fc.process.bind(fc);
var httputil = require('nodeunit').utils.httputil;

exports.testNoChanges = function(test)
{
	httputil(cgi, function(server, client)
	{
		client.fetch('GET', '/template/listChanged?domain=localhost&package=test&version=1.0.2', {}, function (resp)
		{
			test.equal(200, resp.statusCode);
			test.equal('[]', resp.body);
			server.close();
			test.done();
		});
	});
};