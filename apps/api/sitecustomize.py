"""
sitecustomize.py — runs automatically at Python startup.
Monkey-patches numba's JIT caching to prevent the
'no locator available' error in Docker containers.
"""
import os

# Disable numba JIT caching — the cache infrastructure fails in Docker
# overlay filesystems because numba can't determine source file locations.
os.environ.setdefault("NUMBA_DISABLE_CACHING", "1")
os.environ.setdefault("NUMBA_CACHE_DIR", "/tmp/numba_cache")

try:
    import numba
    # Patch the njit decorator to always set cache=False
    _orig_njit = numba.njit
    def _patched_njit(*args, **kwargs):
        kwargs["cache"] = False
        return _orig_njit(*args, **kwargs)
    numba.njit = _patched_njit

    # Also patch jit class decorator
    _orig_jit = numba.jit
    def _patched_jit(*args, **kwargs):
        kwargs["cache"] = False
        return _orig_jit(*args, **kwargs)
    numba.jit = _patched_jit

    # Clear any already-loaded cache directories to prevent stale state
    if hasattr(numba, 'config'):
        numba.config.CACHE_DIR = '/tmp/numba_cache'
except ImportError:
    pass  # numba not installed yet, will be patched when available
