/* Given a list of iframes, adds them to the target div by id.

Iframes should look like this:

const iframe1 = {
  frameborder: 0,
  width: 350,
  height: 60,
  src: "iframe.html",
};

Any property of the object will be passed to the IFRAME element.

*/

function addIframes(iframes, targetDivId) {
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  targetDiv.addEventListener("mouseover", () => toTop(targetDiv));
  for (let iframe of iframes) {
    const frame = document.createElement("IFRAME");
    for (const key in iframe) {
      frame.setAttribute(key, iframe[key]);
    }
    targetDiv.appendChild(frame);
  }
}
