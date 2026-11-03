"""Cache rules for the AFBG phone app shell at /afbg."""

SHELL = "/afbg"


def no_store(response=None, request=None):
	"""The /afbg page names the built files by hash, so a cached copy pins phones to an old
	build. Only the shell is kept out of caches; the hashed assets stay cacheable."""
	if request and response and (request.path == SHELL or request.path.startswith(SHELL + "/")):
		response.headers["Cache-Control"] = "no-store, must-revalidate"
