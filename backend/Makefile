test:
	mkdir -p .tmp
	TMPDIR=$(PWD)/.tmp XCRUN_CACHE_DIR=$(PWD)/.tmp \
	PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONDONTWRITEBYTECODE=1 \
	python3 -m pytest -q -s -p no:cacheprovider -p pytest_asyncio
