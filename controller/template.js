exports.listChanged = function(env)
{
	var release = fc.getRequestRelease(env);
	if (!release)
	{
		return fc.statusResponse(env, 403, 'No access to this release');
	}

	return fc.statusResponse(env, 200, JSON.stringify(release.tplFiles));
}

exports.merge = function(env)
{

}