import canvasSketch from "canvas-sketch";

interface Props {
  width: number;
  height: number;
  context: HTML5CanvasContext;
}

const settings = {
  dimensions: [2048, 2048],
};

const sketch = () => {
  return ({ context, width, height }: Props) => {
    context.fillStyle = "red";
    context.fillRect(0, 0, width, height);
  };
};

canvasSketch(sketch, settings);
