#!/usr/bin/env python
import sys
import os

import setuptools
setuptools.setup(
    name="woodpecker",
    version="1.0",
    author="Jiang Hailong<gombiuda@gmail.com>",
    include_package_data = True,
    packages=setuptools.find_packages('src'),
    package_dir = {'': 'src'},
    package_data = {
        'woodpecker': [
            'static/js/*.js',
            'static/css/*.css',
            'static/css/images/*.gif',
            'static/img/*.png',
        ],
    },
    install_requires=['webapp2', 'requests', 'gevent', 'webob'],
    description="Time recording tool",
)
