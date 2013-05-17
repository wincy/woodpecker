Woodpecker
============

Woodpecker是一个辅助执行时间记录法的工具，记录的内容全部都会保存在 [Asana](http://asana.com "Asana") 上。

如果你想了解更多关于时间记录法，推荐阅读《奇特的一生》一书。


安装方式
--------

    $ brew install libevent
	$ sudo pip install https://github.com/gombiuda/woodpecker/archive/master.zip


使用方式
---------

在你的asana上的Personal工作区中建立一个名为`.woodpecker`的项目，然后在帐户设置中获取你的API key。

	$ export ASANA_API_KEY=<your-asana-api-key>
    $ python -m woodpecker.asana

然后在浏览器中打开页面：`http://localhost:8000/`

在手机上打开也可以，但要先确定手机和电脑在同一个局域网中。


特点
-----

Woodpecker是一个基于Web的离线应用，你可以在它可以连接运行服务端的电脑的时候加载好数据，然后离线使用。

当然它同步数据的时候也是要连接服务端的。


改动日志
--------

* [2013-05-17] 支持修改时间戳
* [2013-05-16] 修复时间线记录创建冗余的问题
* [2013-05-15] 支持离线数据的持久化
