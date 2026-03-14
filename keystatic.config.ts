import { config, collection, singleton, fields } from '@keystatic/core';

export default config({
  storage: import.meta.env.DEV
    ? { kind: 'local' }
    : {
        kind: 'github',
        repo: { owner: 'ccakd', name: 'ccakd-new' },
      },
  ui: {
    brand: { name: 'CCAKD CMS' },
  },
  collections: {
    announcements: collection({
      label: 'Announcements',
      slugField: 'title_en',
      path: 'content/announcements/*',
      schema: {
        title_en: fields.slug({ name: { label: 'Title (English)', validation: { isRequired: true } } }),
        title_zh: fields.text({ label: 'Title (简体中文)' }),
        title_zhtw: fields.text({ label: 'Title (繁體中文)' }),
        body_en: fields.document({
          label: 'Content (English)',
          formatting: true,
          dividers: true,
          links: true,
          images: { directory: 'public/images/announcements', publicPath: '/images/announcements/' },
        }),
        body_zh: fields.document({
          label: 'Content (简体中文)',
          formatting: true,
          dividers: true,
          links: true,
          images: { directory: 'public/images/announcements', publicPath: '/images/announcements/' },
        }),
        body_zhtw: fields.document({
          label: 'Content (繁體中文)',
          formatting: true,
          dividers: true,
          links: true,
          images: { directory: 'public/images/announcements', publicPath: '/images/announcements/' },
        }),
        feature_image: fields.image({
          label: 'Feature Image',
          directory: 'public/images/announcements',
          publicPath: '/images/announcements/',
        }),
        date: fields.date({ label: 'Publish Date', validation: { isRequired: true } }),
        pinned: fields.checkbox({ label: 'Pin to Homepage', defaultValue: false }),
      },
    }),
    programs: collection({
      label: 'Programs',
      slugField: 'title_en',
      path: 'content/programs/*',
      schema: {
        title_en: fields.slug({ name: { label: 'Title (English)', validation: { isRequired: true } } }),
        title_zh: fields.text({ label: 'Title (简体中文)' }),
        title_zhtw: fields.text({ label: 'Title (繁體中文)' }),
        description_en: fields.document({
          label: 'Description (English)',
          formatting: true,
          links: true,
          images: { directory: 'public/images/programs', publicPath: '/images/programs/' },
        }),
        description_zh: fields.document({
          label: 'Description (简体中文)',
          formatting: true,
          links: true,
          images: { directory: 'public/images/programs', publicPath: '/images/programs/' },
        }),
        description_zhtw: fields.document({
          label: 'Description (繁體中文)',
          formatting: true,
          links: true,
          images: { directory: 'public/images/programs', publicPath: '/images/programs/' },
        }),
        feature_image: fields.image({
          label: 'Feature Image',
          directory: 'public/images/programs',
          publicPath: '/images/programs/',
        }),
        schedule_en: fields.text({ label: 'Schedule (English)' }),
        schedule_zh: fields.text({ label: 'Schedule (简体中文)' }),
        schedule_zhtw: fields.text({ label: 'Schedule (繁體中文)' }),
        location_en: fields.text({ label: 'Location (English)' }),
        location_zh: fields.text({ label: 'Location (简体中文)' }),
        location_zhtw: fields.text({ label: 'Location (繁體中文)' }),
        contact: fields.text({ label: 'Contact Info' }),
        fee_en: fields.text({ label: 'Fee (English)' }),
        fee_zh: fields.text({ label: 'Fee (简体中文)' }),
        fee_zhtw: fields.text({ label: 'Fee (繁體中文)' }),
        active: fields.checkbox({ label: 'Active', defaultValue: true }),
      },
    }),
    galleries: collection({
      label: 'Galleries',
      slugField: 'title_en',
      path: 'content/galleries/*',
      schema: {
        title_en: fields.slug({ name: { label: 'Title (English)', validation: { isRequired: true } } }),
        title_zh: fields.text({ label: 'Title (简体中文)' }),
        title_zhtw: fields.text({ label: 'Title (繁體中文)' }),
        gdrive_link: fields.url({
          label: 'Google Drive Folder Link',
          description: 'Paste the shared Google Drive folder URL. The folder must be shared with the CCAKD service account.',
        }),
        date: fields.date({ label: 'Event Date', validation: { isRequired: true } }),
        cover_image: fields.image({
          label: 'Cover Image',
          directory: 'public/images/galleries',
          publicPath: '/images/galleries/',
        }),
        r2_folder: fields.text({
          label: 'R2 Folder (auto-populated)',
          description: 'DO NOT EDIT — set automatically by the gallery pipeline.',
        }),
        photo_manifest: fields.text({
          label: 'Photo Manifest (auto-populated)',
          description: 'DO NOT EDIT — JSON manifest set automatically by the gallery pipeline.',
          multiline: true,
        }),
      },
    }),
  },
  singletons: {
    homepage: singleton({
      label: 'Homepage',
      path: 'content/homepage',
      schema: {
        hero_images: fields.array(
          fields.image({
            label: 'Hero Image',
            directory: 'public/images/hero',
            publicPath: '/images/hero/',
          }),
          { label: 'Hero Carousel Images' }
        ),
        hero_heading_en: fields.text({ label: 'Hero Heading (English)' }),
        hero_heading_zh: fields.text({ label: 'Hero Heading (简体中文)' }),
        hero_heading_zhtw: fields.text({ label: 'Hero Heading (繁體中文)' }),
        hero_cta_link: fields.url({ label: 'Hero CTA Link' }),
        membership_promo_en: fields.document({ label: 'Membership Promo (English)', formatting: true, links: true }),
        membership_promo_zh: fields.document({ label: 'Membership Promo (简体中文)', formatting: true, links: true }),
        membership_promo_zhtw: fields.document({ label: 'Membership Promo (繁體中文)', formatting: true, links: true }),
      },
    }),
    about: singleton({
      label: 'About',
      path: 'content/about',
      schema: {
        purpose_en: fields.document({ label: 'Our Purpose (English)', formatting: true, links: true }),
        purpose_zh: fields.document({ label: 'Our Purpose (简体中文)', formatting: true, links: true }),
        purpose_zhtw: fields.document({ label: 'Our Purpose (繁體中文)', formatting: true, links: true }),
        history_en: fields.document({ label: 'Our History (English)', formatting: true, links: true }),
        history_zh: fields.document({ label: 'Our History (简体中文)', formatting: true, links: true }),
        history_zhtw: fields.document({ label: 'Our History (繁體中文)', formatting: true, links: true }),
        constitution_en_pdf: fields.file({
          label: 'Constitution (English PDF)',
          directory: 'public/files',
          publicPath: '/files/',
        }),
        constitution_zh_pdf: fields.file({
          label: 'Constitution (Chinese PDF)',
          directory: 'public/files',
          publicPath: '/files/',
        }),
        executives: fields.array(
          fields.object({
            name: fields.text({ label: 'Name', validation: { isRequired: true } }),
            title_en: fields.text({ label: 'Title (English)' }),
            title_zh: fields.text({ label: 'Title (简体中文)' }),
            title_zhtw: fields.text({ label: 'Title (繁體中文)' }),
            email: fields.text({ label: 'Email' }),
            photo: fields.image({
              label: 'Photo',
              directory: 'public/images/executives',
              publicPath: '/images/executives/',
            }),
          }),
          {
            label: 'Executives',
            itemLabel: (props) => props.fields.name.value || 'New Executive',
          }
        ),
      },
    }),
    newcomers: singleton({
      label: 'Newcomers',
      path: 'content/newcomers',
      schema: {
        welcome_en: fields.document({ label: 'Welcome Message (English)', formatting: true, links: true }),
        welcome_zh: fields.document({ label: 'Welcome Message (简体中文)', formatting: true, links: true }),
        welcome_zhtw: fields.document({ label: 'Welcome Message (繁體中文)', formatting: true, links: true }),
        resources: fields.array(
          fields.object({
            category: fields.select({
              label: 'Category',
              options: [
                { label: 'Immigrant Services', value: 'immigrant_services' },
                { label: 'Government Services', value: 'government' },
                { label: 'Education', value: 'education' },
                { label: 'Business Support', value: 'business' },
              ],
              defaultValue: 'immigrant_services',
            }),
            icon: fields.select({
              label: 'Icon',
              options: [
                { label: 'Home', value: 'home' },
                { label: 'Hospital', value: 'hospital' },
                { label: 'Heart', value: 'heart' },
                { label: 'School', value: 'school' },
                { label: 'Graduation Cap', value: 'graduation-cap' },
                { label: 'Briefcase', value: 'briefcase' },
                { label: 'Building', value: 'building-2' },
                { label: 'Landmark', value: 'landmark' },
                { label: 'File Text', value: 'file-text' },
                { label: 'ID Card', value: 'id-card' },
                { label: 'Shield Check', value: 'shield-check' },
                { label: 'Users', value: 'users' },
                { label: 'Globe', value: 'globe' },
                { label: 'Phone', value: 'phone' },
                { label: 'Map Pin', value: 'map-pin' },
                { label: 'Book Open', value: 'book-open' },
                { label: 'Handshake', value: 'handshake' },
                { label: 'Rocket', value: 'rocket' },
              ],
              defaultValue: 'globe',
            }),
            title_en: fields.text({ label: 'Title (English)', validation: { isRequired: true } }),
            title_zh: fields.text({ label: 'Title (简体中文)' }),
            title_zhtw: fields.text({ label: 'Title (繁體中文)' }),
            description_en: fields.text({ label: 'Description (English)' }),
            description_zh: fields.text({ label: 'Description (简体中文)' }),
            description_zhtw: fields.text({ label: 'Description (繁體中文)' }),
            url: fields.url({ label: 'URL', validation: { isRequired: true } }),
          }),
          {
            label: 'Resources',
            itemLabel: (props) => props.fields.title_en.value || 'New Resource',
          }
        ),
      },
    }),
    terms: singleton({
      label: 'Terms & Conditions',
      path: 'content/terms',
      schema: {
        body_en: fields.document({ label: 'Terms (English)', formatting: true, links: true }),
        body_zh: fields.document({ label: 'Terms (简体中文)', formatting: true, links: true }),
        body_zhtw: fields.document({ label: 'Terms (繁體中文)', formatting: true, links: true }),
      },
    }),
  },
});
