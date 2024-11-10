mocha.checkLeaks();
mocha.run();

describe("Title handling", function () {
  it("plain text should be detected", function () {
    const t = `# Something to do
foo`;
    const parsed = textToTaskObject(t);
    chai.expect(parsed.text).to.eql("Something to do");
  });
  it("with link should be detected", function () {
    const t = `# [Something to do](https://google.com)

foo`;
    const parsed = textToTaskObject(t);
    chai.expect(parsed.text).to.eql("Something to do");
    chai.expect(parsed.link).to.eql("https://google.com");
    chai.expect(parsed.done).to.not.be.true;
  });
  it("with [x] and [X] should be marked as done", function () {
    const t1 = `# [x] [Something to do](https://google.com)

foo`;
    let parsed = textToTaskObject(t1);
    chai.expect(parsed.text).to.eql("Something to do");
    chai.expect(parsed.link).to.eql("https://google.com");
    chai.expect(parsed.done).to.be.true;
    const t2 = `# [X] [Something to doo](https://google.com)

foo`;
    parsed = textToTaskObject(t2);
    chai.expect(parsed.text).to.eql("Something to doo");
    chai.expect(parsed.link).to.eql("https://google.com");
    chai.expect(parsed.done).to.be.true;
  });

  it("with overhanging project should keep the project", function () {
    const t = `# [Something to do](https://google.com) .project

foo`;
    const parsed = textToTaskObject(t);
    chai.expect(parsed.text).to.eql("Something to do .project");
    chai.expect(parsed.link).to.eql("https://google.com");
    chai.expect(parsed.done).to.not.be.true;
  });
});

describe("Property handling", function () {
  it("priority should be handled", function () {
    const t = `# Something to do
  prio: 20
foo`;
    const parsed = textToTaskObject(t);
    chai.expect(parsed.text).to.eql("Something to do");
    chai.expect(parsed.prio).to.eql(20);
    chai.expect(parsed.extra).to.eql("foo");
  });
  it("sublinks should be handled", function () {
    const t = `# Something to do
  prio: 20
  - [l1](foo.com)
  - [l2](bar.com)
foo`;
    const parsed = textToTaskObject(t);
    chai.expect(parsed.text).to.eql("Something to do");
    chai.expect(parsed.prio).to.eql(20);
    chai.expect(parsed.links[0]).to.eql(["l1", "foo.com"]);
    chai.expect(parsed.links[1]).to.eql(["l2", "bar.com"]);
    chai.expect(parsed.extra).to.eql("foo");
  });
  it("messages should be handled", function () {
    const t = `# Something to do
  prio: 20
  - msg1
  - [l1](foo.com)
  - [l2](bar.com)
  - msg2
foo`;
    const parsed = textToTaskObject(t);
    console.log(parsed);
    chai.expect(parsed.text).to.eql("Something to do");
    chai.expect(parsed.prio).to.eql(20);
    chai.expect(parsed.links[0]).to.eql(["l1", "foo.com"]);
    chai.expect(parsed.links[1]).to.eql(["l2", "bar.com"]);
    chai.expect(parsed.msg).to.eql(["msg1", "msg2"]);
  });
  it("color override should be handled", function () {
    const t = `# Something to do
  prio: 20
  - msg1
  - [l1](foo.com)
  - [l2](bar.com)
  color: ultraviolet
  - msg2
foo`;
    const parsed = textToTaskObject(t);
    console.log(parsed);
    chai.expect(parsed.text).to.eql("Something to do");
    chai.expect(parsed.prio).to.eql(20);
    chai.expect(parsed.links[0]).to.eql(["l1", "foo.com"]);
    chai.expect(parsed.links[1]).to.eql(["l2", "bar.com"]);
    chai.expect(parsed.msg).to.eql(["msg1", "msg2"]);
    chai.expect(parsed.color).to.eql("ultraviolet");
  });
  it("extra color override should be handled", function () {
    const t = `# Something to do
  prio: 20
  - msg1
  - [l1](foo.com)
  - [l2](bar.com)
  extracolor: maroon
  color: ultraviolet
  - msg2
foo`;
    const parsed = textToTaskObject(t);
    console.log(parsed);
    chai.expect(parsed.text).to.eql("Something to do");
    chai.expect(parsed.prio).to.eql(20);
    chai.expect(parsed.links[0]).to.eql(["l1", "foo.com"]);
    chai.expect(parsed.links[1]).to.eql(["l2", "bar.com"]);
    chai.expect(parsed.msg).to.eql(["msg1", "msg2"]);
    chai.expect(parsed.color).to.eql("ultraviolet");
    chai.expect(parsed.extraColor).to.eql("maroon");
  });
});

describe("Settings list handling", function () {
  it("should all be added", function () {
    const t = `# Settings
- backgroundColor: ultraviolet
- fontSize: 900vh
`;
    const parsed = textToTaskObject(t);
    chai.expect(parsed.settings.backgroundColor).to.eql("ultraviolet");
    chai.expect(parsed.settings.fontSize).to.eql("900vh");
  });
});

describe("HR (horizontal row) handling", function () {
  it("should be parsed", function () {
    const t = `# hr
prio: 20
color: ultraviolet
`;
    const parsed = textToTaskObject(t);
    chai.expect(parsed.hr).to.be.true;
    chai.expect(parsed.color).to.eql("ultraviolet");
  });
});

describe("Project list handling", function () {
  it("should be parsed", function () {
    const t = `# Projects
- p1, p2
- p4
`;
    const parsed = textToTaskObject(t);
    chai.expect(parsed.projects).to.not.be.false;
    chai.expect(parsed.projects).to.eql([["p1", "p2"], "p4"]);
  });
});
