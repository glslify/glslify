interface GlslifyOption {
  basedir?: string;
  transform?: any;
}
interface Glslify {
  (template: TemplateStringsArray, ...args: any[]): string;
  (file: any, option?: GlslifyOption);
  compile(src: string, option?: GlslifyOption): string;
  filename(filename: string, option?: GlslifyOption): string;
}

const glsl: Glslify;
export default glsl;
