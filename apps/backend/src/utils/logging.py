from loguru import logger
import sys


# Hinglish: Pretty logging — prod mein rotate/serialize add kar sakte ho.
logger.remove()
logger.add(sys.stderr, level="INFO", colorize=True)