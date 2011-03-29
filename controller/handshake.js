exports.index = function(env)
{
	var domain = fc.getQueryVar(env, 'domain');
	domain = domain.match(/[\.-a-zA-Z0-9]/);

	if (!domain)
	{
		return fc.statusResponse(501, 'Domain name missing')
	}

	require('dns').resolve4(domain,
		function(err, ips)
		{
			if ('localhost' != domain)
			{
				if (err || (-1 == ips.indexOf(env.request.connection.remoteAddress)))
				{
					return fc.statusResponse(501, 'Domain name does not match request IP address')
				}
			}

			var mysql = require('./helper/util').mysql;
			mysql.connect(function(err, results)
				{
					if (err)
					{
						throw err;
					}

					mysql.query("SELECT * From OrderedItemOption WHERE optionText LIKE '%" + domain + "%'",
						function(err, results, fields)
						{
							console.log(results);

							var allowedPackages = ['livecart'];
						});
				});
		});
}