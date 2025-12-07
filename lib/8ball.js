// lib/8ball.js

function process8Ball(items) {
  if (!items || items.length === 0) return;

  items.forEach((item, index) => {
    // Extract answers: keys that are not known metadata
    const metadata = ["kind", "title", "div", "top", "left", "right", "bottom"];
    let answers = Object.keys(item).filter(
      (k) => !metadata.includes(k) && item[k] === "",
    );

    let ballColor = null;
    let ballNumber = "8";

    if (item.title) {
      ballNumber = item.title;
      if (answers.length > 0) {
        // First "answer" is actually the color
        ballColor = answers[0];
        answers = answers.slice(1);
      }
    }

    if (answers.length === 0) {
      console.warn("8 Ball defined but no answers found.");
      return;
    }

    createSingle8Ball(item, answers, index, ballNumber, ballColor);
  });
}

function createSingle8Ball(item, answers, index, numberText, colorString) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("eight-ball-wrapper");
  wrapper.id = item.div || `eight-ball-${index}`;

  if (colorString) {
    // Basic color support - could be improved with better gradients
    // We try to keep the 3d look by using the color in a gradient
    wrapper.style.background = `radial-gradient(circle at 35% 35%, #777, ${colorString} 40%, #000 95%)`;
  }

  // Position
  if (item.left) wrapper.style.left = item.left;
  if (item.top) wrapper.style.top = item.top;
  if (item.right) wrapper.style.right = item.right;
  if (item.bottom) wrapper.style.bottom = item.bottom;

  // Inner structure
  const inner = document.createElement("div");
  inner.classList.add("eight-ball-inner");

  // Number side
  const numberBg = document.createElement("div");
  numberBg.classList.add("eight-ball-number-bg");
  const number = document.createElement("div");
  number.classList.add("eight-ball-number");
  number.innerText = numberText;
  numberBg.appendChild(number);

  // Answer side (blue triangle)
  const triangle = document.createElement("div");
  triangle.classList.add("eight-ball-triangle");
  const answerText = document.createElement("span");
  answerText.classList.add("eight-ball-answer-text");
  triangle.appendChild(answerText);

  inner.appendChild(numberBg);
  inner.appendChild(triangle);
  wrapper.appendChild(inner);

  document.body.appendChild(wrapper);

  // State
  let isDragging = false;
  let isShaking = false;
  let shakeScore = 0;
  let lastDirectionX = 0;
  let answerTimeout = null;

  // Interact
  interact(wrapper).draggable({
    inertia: true,
    autoScroll: true,
    listeners: {
      start(event) {
        if (answerTimeout) clearTimeout(answerTimeout);
        isDragging = true;
        shakeScore = 0;
        lastDirectionX = 0;
        wrapper.classList.add("state-dragging");
        wrapper.classList.remove("state-answering");
        // triangle.style.opacity = '0'; // Removed inline style to allow CSS class control
      },
      move(event) {
        const target = event.target;
        // Keep the drag position
        const x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;

        // Translate the element
        target.style.transform = `translate(${x}px, ${y}px)`;

        // Update the posiion attributes
        target.setAttribute("data-x", x);
        target.setAttribute("data-y", y);

        // Shake detection
        // Lowered threshold for sensitivity
        const dx = event.dx;

        // Lowered speed threshold from 5 to 3
        if (Math.abs(dx) > 3) {
          const directionX = Math.sign(dx);
          if (lastDirectionX !== 0 && directionX !== lastDirectionX) {
            shakeScore++;
            // Lowered shake needed from 4 to 3
            if (shakeScore > 3) {
              isShaking = true;
              // Could add visual feedback for shaking here if desired
            }
          }
          lastDirectionX = directionX;
        }
      },
      end(event) {
        isDragging = false;

        if (isShaking) {
          // Reveal answer
          const randomAnswer =
            answers[Math.floor(Math.random() * answers.length)];
          answerText.innerText = randomAnswer;

          wrapper.classList.remove("state-dragging");
          wrapper.classList.add("state-answering");

          // Reset after some time
          answerTimeout = setTimeout(() => {
            wrapper.classList.remove("state-answering");
            // The CSS transition will animate correct reset
            isShaking = false;
            shakeScore = 0;
          }, 5000);
        } else {
          // Just return to number state
          wrapper.classList.remove("state-dragging");
          wrapper.classList.remove("state-answering");
        }
        isShaking = false;
        shakeScore = 0;
      },
    },
  });
}

// Global scope
window.process8Ball = process8Ball;
