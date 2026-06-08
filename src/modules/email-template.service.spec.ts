describe(
  "EmailTemplateService",
  () => {

    it(
      "renders variables correctly",
      async () => {

        const result =
          await service.preview(
            "template-id",
            {
              firstName:
                "Muhammad",
            },
          );

        expect(
          result.body,
        ).toContain(
          "Muhammad",
        );
      },
    );

    it(
      "returns rendered subject",
      async () => {

        const result =
          await service.preview(
            "template-id",
            {
              coupon:
                "SAVE20",
            },
          );

        expect(
          result.subject,
        ).not.toContain(
          "{{coupon}}",
        );
      },
    );
  },
);