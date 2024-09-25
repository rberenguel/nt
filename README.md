# NT (new tab)

A customizable new tab extension for Chrome.

## What does it do?

This is inspired by something I use somewhere else, but way easier to customize and tweak.
It lets you put named timezones anywhere, rotate backgrounds from a list, iframes,
and offers _quicklinks_.

## Quicklinks?

Yes.

In the basic examples of this screenshot, there are a bunch of quicklinks for Google stuff.
If you want to open Google, you can press `g` (it will highlight all links that match) and
then `o` to go to Google. To access this functionality after creating a new tab with `Cmd-Tab`
(or whatever creates a new tab in your computer), press ESC to switch focus to the page. So,
the flow would be `Cmd-Tab ESC g o`

![](media/screenshot.png)

## Installation

## <a name='Installing'></a>Installing

- Clone or download (remember then to unzip) this repository somewhere.
- In **Chrome**, _More tools > Extensions_…
- In **Chrome > Extensions**, _Enable developer mode_.
- Click _Load unpacked_, then browse to where you downloaded the repository

When you enable it, the first time you create a new tab it will ask for confirmation that you are happy.

## Tweaking

Just edit the source you have downloaded, and in the Chrome Extensions manager, click update (many times
this is not even needed, just a refresh).

This is thrown together in one folder on purpose, to make it easier to edit without wondering where anything
is. Everything is in this folder (except for backgrounds).

## Image credits

All images are algorithmic art pieces I have created, see [mostlymaths.net/sketches](https://mostlymaths.net/sketches)

## Attribution

- Uses the [luxon.js](https://moment.github.io/luxon/#/) datetime library
- Many thanks to [Google Gemini](http://gemini.google.com") for the help.
