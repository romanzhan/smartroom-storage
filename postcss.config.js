import purgecss from "@fullhuman/postcss-purgecss";

export default {
  plugins: [
    purgecss({
      content: ["./src/**/*.html", "./src/**/*.js"],
      defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
      safelist: [
        /^is-/,
        /^has-/,
        /active/,
        /show/,
        /hide/,
        /error/,
        /success/,
        /gsap-/,
        /^sm-/,
        /^md-/,
        /^lg-/,
      ],
    }),
  ],
};
