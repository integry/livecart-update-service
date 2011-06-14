exports.channels = function(env)
{
	var channels = fc.getPackages().getPackageChannels(fc.getQueryVar(env, 'package'));
	if (channels)
	{
		return fc.statusResponse(env, 200, JSON.stringify(channels));
	}
	else
	{
		return fc.statusResponse(env, 404, 'No channels found');
	}
}

exports.versions = function(env)
{
	var q = fc.getQuery(env);
	var versions = fc.getPackages().getPackageVersions(q('package'), q('channel'));
	if (versions)
	{
		return fc.statusResponse(env, 200, JSON.stringify(versions));
	}
	else
	{
		return fc.statusResponse(env, 404, 'No versions found');
	}
}

exports.updatePath = function(env)
{
	var q = fc.getQuery(env);
	var p = fc.getPackages();
	return fc.statusResponse(env, 200, JSON.stringify(p.getClientPkgData(p.getUpdatePath(q('package'), q('from'), q('to')))));
}

exports.download = function(env)
{
	var q = fc.getQuery(env);
	if (!fc.isPackageAllowed(env, q('package')))
	{
		return fc.statusResponse(env, 403, 'Package is not allowed');
	}

	var package = fc.getPackages().getUpdatePackage(q('package'), q('from'), q('to'));
	if (package)
	{
		var fs = require('fs');

		// @todo: substr(0, -6) returns blank string, a bug in node.js?
		fs.readFile(package.file.substr(0, package.file.length - 6) + 'zip', function(err, data)
		{
			if (!err)
			{
				fc.statusResponse(env, 200, data);
			}
			else
			{
				fc.statusResponse(env, 403);
			}
		});
	}
}

exports.downloadInstall = function(env)
{
	var q = fc.getQuery(env);
	if (!fc.isPackageAllowed(env, q('package')))
	{
		return fc.statusResponse(env, 403, 'Package is not allowed');
	}

	var package = fc.getPackages().getNewestVersion(q('package'));

	if (package)
	{
		require('fs').readFile(package.file + '.zip', function(err, data)
		{
			if (!err)
			{
				fc.statusResponse(env, 200, data);
			}
			else
			{
				fc.statusResponse(env, 403);
			}
		});
	}
	else
	{
		fc.statusResponse(env, 404, q('package') + ' not found');
	}
}

exports.list = function(env)
{
	var q = fc.getQuery(env);
	var list = [];
	var pkg = fc.getPackages();
	var free = pkg.getFreePackages();
	for (var i in free)
	{
		var info = pkg.getNewestVersion(free[i]);
		if (info.pkg)
		{
			list.push(info);
		}
	};

	fc.statusResponse(env, 200, JSON.stringify(pkg.getClientPkgData(list)));
}