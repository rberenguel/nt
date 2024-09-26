# NT (new tab)

<!-- vscode-markdown-toc -->

- [What does it do?](#Whatdoesitdo)
- [What are quicklinks?](#Whatarequicklinks)
- [Installation](#Installation)
- [Installing](#Installing)
- [Tweaking](#Tweaking)
- [Safari?](#Safari)
- [Image credits](#Imagecredits)
- [Attribution](#Attribution)

<!-- vscode-markdown-toc-config
	numbering=false
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

A customizable new tab extension for Chrome.

## <a name='Whatdoesitdo'></a>What does it do?

This is inspired by something I use somewhere else, but way easier to customize and tweak.
It lets you put named timezones anywhere, rotate backgrounds from a list, iframes,
and offers _quicklinks_.

## <a name='Whatarequicklinks'></a>What are quicklinks?

This is hard to explain.

In the basic examples of the screenshot below, there are a bunch of quicklinks for Google stuff.
If you want to open Google, you can press `g` (it will highlight all links that match) and
then `o` to go to Google. To access this functionality after creating a new tab with `Cmd-Tab`
(or whatever creates a new tab in your computer), press `ESC` to switch focus to the page. So,
the flow would be `Cmd-Tab ESC g o`

![](media/screenshot.png)

They are optional, you can find more about how to set links up in the links file.

Shortcuts can be more than one letter as long as they do not overlap. So, don't use `gg` for one link
and `gga` for another. If you want to have a lot of links, you can optionally add columns, separators
and tweak the font size without needing to the CSS (even if it is available to edit, it is always a hassle!).

## <a name='Installation'></a>Installation

## <a name='Installing'></a>Installing

- Clone or download (remember then to unzip) this repository somewhere.
- In **Chrome**, _More tools > Extensions_…
- In **Chrome > Extensions**, _Enable developer mode_.
- Click _Load unpacked_, then browse to where you downloaded the repository

When you enable it, the first time you create a new tab it will ask for confirmation that you are happy.

## <a name='Tweaking'></a>Tweaking

Just edit the source you have downloaded, and in the Chrome Extensions manager, click update (many times
this is not even needed, just a refresh).

This is thrown together in one folder on purpose, to make it easier to edit without wondering where anything
is. Everything is in this folder (except for backgrounds).

I will add some more documentation at some point.

## <a name='Safari'></a>Safari?

I haven't checked yet, but I had great success auto-porting [bestBefore](https://github.com/rberenguel/bestBefore)
to Safari with Apple's autoconverter.

I think I'd like to have this in Safari too.

## <a name='Imagecredits'></a>Image credits

All images are algorithmic art pieces I have created, see [mostlymaths.net/sketches](https://mostlymaths.net/sketches)

## <a name='Attribution'></a>Attribution

- Uses the [luxon.js](https://moment.github.io/luxon/#/) datetime library
- Many thanks to [Google Gemini](http://gemini.google.com") for the help.
