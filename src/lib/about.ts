export type AboutContent = {
  title: string;
  intro: string;
  story: string;
  mission: string;
  values: string;
  serviceArea: string;
};
export type AboutPage = {
  revision: number;
  draft: AboutContent;
  published: AboutContent | null;
  publishedAt?: number | null;
};
export const blankAbout: AboutContent = {
  title: "",
  intro: "",
  story: "",
  mission: "",
  values: "",
  serviceArea: "",
};
