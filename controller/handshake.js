exports.index = function(env)
{
	var domain = fc.getQueryVar(env, 'domain');

	if (!domain)
	{
		return fc.statusResponse(env, 403, 'Domain name missing')
	}

	if (DSN)
	{
		require('dns').resolve4('localhost' == domain ? '127.0.0.1' : domain,
			function(err, ips)
			{
				if (('localhost' != domain) && !ALLOW_LOCALHOST_ACCESS)
				{
					if (env.request.headers['x-real-ip'])
					{
						env.request.connection.remoteAddress = env.request.headers['x-real-ip'];
					}

					if (err || (-1 == ips.indexOf(env.request.connection.remoteAddress)))
					{
						return fc.statusResponse(env, 403, 'Domain name does not match request IP address')
					}
				}

				var mysql = require('../helper/util.js').mysql();
				mysql.connect(function(err, results)
				{
					if (err)
					{
						throw err;
					}

					mysql.query("SELECT * From OrderedItemOption WHERE optionText LIKE ?", ['%' + domain],
						function(err, results, fields)
						{
							if (!results.length)
							{
								return fc.statusResponse(env, 403, 'There is no license with "' + domain + '" as the registered domain name');
							}

							fc.statusResponse(env, 200, JSON.stringify(fc.createHandshake(null, domain)));
						});
				});
			});
	}
	else
	{
		fc.statusResponse(env, 200, JSON.stringify(fc.createHandshake(null, domain)));
	}
}