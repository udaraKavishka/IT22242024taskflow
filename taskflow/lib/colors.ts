const palette = [
  "#61bd4f",
  "#f2d600",
  "#ff9f1a",
  "#eb5a46",
  "#c377e0",
  "#0079bf",
  "#344563",
  "#ff78cb",
  "#519839",
  "#b04632",
];

export const randomColor = () => {
  return palette[Math.floor(Math.random() * palette.length)];
};
