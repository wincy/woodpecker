function Cursor(container, format) {
    this.container = container;
    this.format = format;
    this.position = 0;
}

Cursor.prototype = {
    init: function(defaults) {
	this.defaults = defaults;
	var csr = this;
	var parse_tree = sprintf.parse(this.format);
	var value = vsprintf(this.format, defaults);
	$(this.container).empty();
	for (var i = 0; i < value.length; i++) {
	    var kls = $.type(parse_tree[i]) == "string" ? "cursor-fixed" : "cursor-variable";
	    var box = $('<div class="' + kls + '">' + value[i] + '</div>');
	    if (kls == "cursor-variable") {
		box.click(function () {
		    csr.jump($(".cursor-variable", $(csr.container)).index(this));
		});
	    }
	    $(this.container).append(box);
	}
	$(".cursor-variable:first-child",
	  $(this.container)).addClass("cursor-current");
	return this;
    },
    reset: function() {
	$(".cursor-variable:eq(" + this.position + ")",
	  $(this.container)).removeClass("cursor-current");
	this.position = 0;
	$(".cursor-variable:first-child",
	  $(this.container)).addClass("cursor-current");
	return this;
    },
    next: function() {
	$(".cursor-variable:eq(" + this.position + ")",
	  $(this.container)).removeClass("cursor-current");
	this.position = (this.position + 1) % $(".cursor-variable", $(this.container)).length;
	$(".cursor-variable:eq(" + this.position + ")",
	  $(this.container)).addClass("cursor-current");
	return this;
    },
    jump: function(n) {
	$(".cursor-variable:eq(" + this.position + ")",
	  $(this.container)).removeClass("cursor-current");
	this.position = n;
	$(".cursor-variable:eq(" + n + ")",
	  $(this.container)).addClass("cursor-current");
	return this;
    },
    set: function(value) {
	var parse_tree = sprintf.parse(this.format);
	$(".cursor-variable:eq(" + this.position + ")",
	  $(this.container)).text(sprintf(
	      $(parse_tree).filter(function () {
		  return $.type(this) == "array";
	      })[this.position][0],
	      value));
	return this;
    },
    mget: function(start, end) {
	var selector = ".cursor-variable";
	if (start - 1 >= 0) {
	    selector = selector + ":gt(" + (start - 1) + ")";
	}
	selector = selector + ":lt(" + end + ")"
	return $(selector, $(this.container)).map(function () {
	    return $(this).text();
	});
    },
    mset: function(start, args) {
	var parse_tree = sprintf.parse(this.format);
	this.jump(start);
	for (var i = 0; i < args.length; i++) {
	    this.set(args[i]);
	    this.next();
	}
	return this;
    },
};
