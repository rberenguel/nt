if (location.href.startsWith("http")) {
  document.write('<script src="main.js"></script>');
} else {
  document.write('<script src="local_main.js"></script>');
}
