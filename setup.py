#!/usr/bin/env python
import sys
import os

import setuptools
setuptools.setup(
    name="woodpecker",
    version="1.0",
    author="Jiang Hailong<gombiuda@gmail.com>",
    packages=['woodpecker'],
    install_requires=['webapp2', 'requests', 'gevent', 'webob'],
    description="Time recording tool",
)
