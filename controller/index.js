exports.index = function(env)
{
	return fc.statusResponse(env, 200, REPO_DESCRIPTION);
}