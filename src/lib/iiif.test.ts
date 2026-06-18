import { describe, expect, it } from "vitest";
import { looksLikeIiifUrl, parseIiif } from "./iiif";

describe("looksLikeIiifUrl", () => {
  it("manifest.json / info.json / manifest を IIIF らしいと判定する", () => {
    expect(looksLikeIiifUrl("https://x.org/iiif/book/manifest.json")).toBe(true);
    expect(looksLikeIiifUrl("https://x.org/iiif/img/info.json")).toBe(true);
    expect(looksLikeIiifUrl("https://x.org/iiif/book/manifest")).toBe(true);
    expect(looksLikeIiifUrl("https://x.org/photo.jpg")).toBe(false);
  });
});

describe("parseIiif", () => {
  it("Presentation v2 マニフェストを解釈する", () => {
    const doc = parseIiif({
      "@context": "http://iiif.io/api/presentation/2/context.json",
      "@type": "sc:Manifest",
      label: "竹取物語",
      sequences: [
        {
          canvases: [
            {
              "@id": "https://x.org/canvas/1",
              label: "1",
              images: [
                {
                  resource: {
                    "@id": "https://x.org/iiif/p1/full/full/0/default.jpg",
                    service: {
                      "@context": "http://iiif.io/api/image/2/context.json",
                      "@id": "https://x.org/iiif/p1",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(doc?.label).toBe("竹取物語");
    expect(doc?.pages).toHaveLength(1);
    expect(doc?.pages[0].id).toBe("https://x.org/canvas/1");
    expect(doc?.pages[0].imageUrl).toBe("https://x.org/iiif/p1/full/full/0/default.jpg");
    expect(doc?.pages[0].thumbUrl).toBe("https://x.org/iiif/p1/full/,160/0/default.jpg");
  });

  it("Presentation v3 マニフェストを解釈する", () => {
    const doc = parseIiif({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      type: "Manifest",
      label: { ja: ["東寺百合文書"] },
      items: [
        {
          id: "https://x.org/canvas/1",
          type: "Canvas",
          label: { none: ["p. 1"] },
          items: [
            {
              type: "AnnotationPage",
              items: [
                {
                  type: "Annotation",
                  body: {
                    id: "https://x.org/iiif/p1/full/max/0/default.jpg",
                    type: "Image",
                    service: [{ id: "https://x.org/iiif/p1", type: "ImageService3" }],
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(doc?.label).toBe("東寺百合文書");
    expect(doc?.pages[0].label).toBe("p. 1");
    expect(doc?.pages[0].imageUrl).toBe("https://x.org/iiif/p1/full/max/0/default.jpg");
  });

  it("Image API info.json を 1 ページとして解釈する", () => {
    const doc = parseIiif({
      "@context": "http://iiif.io/api/image/2/context.json",
      "@id": "https://x.org/iiif/p1",
      profile: "http://iiif.io/api/image/2/level2.json",
    });
    expect(doc?.pages).toHaveLength(1);
    expect(doc?.pages[0].imageUrl).toBe("https://x.org/iiif/p1/full/full/0/default.jpg");
  });

  it("IIIF でない JSON は null", () => {
    expect(parseIiif({ hello: "world" })).toBeNull();
    expect(parseIiif(null)).toBeNull();
  });
});
