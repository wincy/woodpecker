define("app/timepicker", ["jquery", "app/cursor"], function() {
    function TimePicker(container) {
	this.container = container;
	this.cursor = null;
    }
    TimePicker.prototype = {
	init: function() {
	    var timepicker = this;
	    this.hide();
	    $(this.container).addClass("popup");
	    var title = $('<h3 class="timepicker-title"></h3>');
	    $(this.container).append(title);
	    var cursor = $('<div class="timepicker-cursor"></div>');
	    $(this.container).append(cursor)
	    this.cursor = new Cursor(cursor, "%s%s:%s%s");
	    this.cursor.init([0,0,0,0]);
	    var numpad = $('<div class="timepicker-numpad"></div>');
	    var buttons = [["single", "1"],
			   ["single", "2"],
			   ["single", "3"],
			   ["minutes", ":15"],
			   ["single", "4"],
			   ["single", "5"],
			   ["single", "6"],
			   ["minutes", ":30"],
			   ["single", "7"],
			   ["single", "8"],
			   ["single", "9"],
			   ["minutes", ":45"],
			   ["reset", "reset"],
			   ["single", "0"],
			   ["now", "now"],
			   ["minutes", ":00"]];
	    var cursor = this.cursor;
	    for (var i = 0; i < buttons.length; i++) {
		var elem = $('<div class="timepicker-button timepicker-set-'
			     + buttons[i][0] + '">'
			     + buttons[i][1] + '</div>');
		switch(buttons[i][0]) {
		case "single":
		    elem.click(function () {
			cursor.set($(this).text());
			cursor.next();
		    });
		    break;
		case "minutes":
		    elem.click(function () {
			cursor.jump(2).set($(this).text()[1]);
			cursor.jump(3).set($(this).text()[2]);
			cursor.next();
		    });
		    break;
		case "reset":
		    elem.click(function() {
			cursor.reset();
		    });
		    break;
		case "now":
		    elem.click(function() {
			var now = new Date();
			cursor.mset(0,
				    [Math.floor(now.getHours() / 10),
				     now.getHours() % 10,
				     Math.floor(now.getMinutes() / 10),
				     now.getMinutes() % 10]);
		    });
		    break;
		}
		numpad.append(elem);
	    }
	    $(this.container).append(numpad);
	    var asks = $('<div class="row-fluid"></div>');
	    var cancel = $('<span class="time-cancel punch span5 offset1">Cancel</span>');
	    var confirm = $('<span class="time-confirm punch span5">OK</span>');
	    asks.append(cancel).append(confirm);
	    cancel.click(function() {
		timepicker.hide();
	    })
	    $(this.container).append(asks);
	},
	show: function() {
	    $(this.container).show();
	},
	hide: function() {
	    $(this.container).hide();
	},
	ask: function(title, callback) {
	    var timepicker = this;
	    var cursor = this.cursor;
	    $(".timepicker-title", $(this.container)).text(title);
	    $(".time-confirm", $(this.container)).click(function() {
		var hours = parseInt(cursor.mget(0, 2).toArray().join(""));
		var minutes = parseInt(cursor.mget(2, 4).toArray().join(""));
		var now = new Date();
		now.setHours(hours);
		now.setMinutes(minutes);
		timepicker.hide();
		callback(now);
	    });
	    this.show();
	}
    }
    return TimePicker;
});
