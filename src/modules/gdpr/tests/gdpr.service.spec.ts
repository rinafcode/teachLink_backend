describe(
  "GdprService",
  () => {

    it(
      "exports user data",
      async () => {

        const result =
          await service.exportUserData(
            "user-1",
          );

        expect(
          result.profile,
        ).toBeDefined();
      },
    );

    it(
      "erases user data",
      async () => {

        const result =
          await service.eraseUserData(
            "user-1",
          );

        expect(
          result.success,
        ).toBe(true);
      },
    );

    it(
      "stores consent changes",
      async () => {

        const result =
          await service.updateConsent(
            "user-1",
            {
              consentType:
                "MARKETING",
              granted: true,
            },
          );

        expect(
          result.granted,
        ).toBe(true);
      },
    );
  },
);