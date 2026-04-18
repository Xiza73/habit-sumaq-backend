import { validate } from 'class-validator';

import { IsIanaTimezone } from './is-iana-timezone.validator';

class Dto {
  @IsIanaTimezone()
  timezone!: string;
}

function buildDto(value: unknown): Dto {
  const dto = new Dto();
  // Cast to unknown first to allow invalid values for negative cases.
  dto.timezone = value as string;
  return dto;
}

describe('IsIanaTimezone', () => {
  it.each([
    'UTC',
    'America/Lima',
    'America/Mexico_City',
    'America/Argentina/Buenos_Aires',
    'Europe/Madrid',
    'Asia/Tokyo',
  ])('accepts "%s"', async (value) => {
    const errors = await validate(buildDto(value));
    expect(errors).toHaveLength(0);
  });

  it.each(['Not/A/Timezone', 'UTCplus5', '', 'Mars/Colony'])(
    'rejects "%s"',
    async (value) => {
      const errors = await validate(buildDto(value));
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isIanaTimezone');
    },
  );

  it.each([123, null, undefined, {}])('rejects non-string %p', async (value) => {
    const errors = await validate(buildDto(value));
    expect(errors).toHaveLength(1);
  });
});
