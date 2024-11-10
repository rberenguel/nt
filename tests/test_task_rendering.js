mocha.run();

const trs = () => document.querySelectorAll(".taskRow");
const clean = () => {
  document.querySelector("#lower-left").innerHTML = "";
  window._tasks = undefined;
};

const mev = (_clientX, _clientY, kind) => {
  let clientX = _clientX;
  let clientY = _clientY;

  let ev = new MouseEvent(kind, {
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  });
  return ev;
};

describe("Titles", function () {
  this.slow(1000);
  let _target;
  it("plain should be rendered", function (done) {
    const t = `# Something to do
foo`;
    const parsed = textToTaskObject(t);
    addTasksToDiv([parsed], "lower-left");
    const tr = trs()[0];
    chai
      .expect(tr.querySelector(".taskText").textContent)
      .to.eql("Something to do");
    chai.expect(tr.querySelector(".taskExtra").textContent).to.eql("foo");
    const tt = () => trs()[0].querySelector(".taskTitle");
    _target = tt();
    setTimeout(done, 100);
  });
  it("should react to contextmenu on the task title and highlight the whole row", function (done) {
    const cm = mev(0, 0, "contextmenu");
    _target.dispatchEvent(cm);
    console.log(_target.closest(".taskRow"));
    chai.expect(_target.closest(".taskRow").classList.contains("highlight")).to
      .be.true;
    clean();
    setTimeout(done, 100);
  });
  it("with link should be rendered correctly, with a click handler", function () {
    const t = `# [Something to do](https://google.com)

foo`;
    const parsed = textToTaskObject(t);
    addTasksToDiv([parsed], "lower-left");
    const tr = trs()[0];
    const tt = tr.querySelector(".taskTitle");
    chai.expect(tt.textContent).to.eql("Something to do 🔗");
    chai.expect(tr.querySelector(".taskExtra").textContent).to.eql("foo");
    const listener = tt._clickHandler;
    chai.expect(listener).to.be.eql(linkHandler);
    chai.expect(tt.dataset["destination"]).to.eql("https://google.com");
  });
});
