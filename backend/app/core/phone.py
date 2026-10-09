import re


_SEPARATORS = re.compile(r'[\s().-]')


def normalize_phone_number(value: str) -> str | None:
    """Return a canonical E.164 phone number for supported phone-like input."""
    candidate = value.strip()
    digits_only = _SEPARATORS.sub('', candidate)
    if not digits_only:
        return None
    has_plus = digits_only.startswith('+')
    digits = digits_only[1:] if has_plus else digits_only
    if not digits.isascii() or not digits.isdigit():
        return None
    if not has_plus and len(digits) == 10:
        digits = '91' + digits
    if len(digits) < 8 or len(digits) > 15 or digits.startswith('0') or (
        digits.startswith('91') and len(digits) == 12 and digits[2] == '0'
    ):
        raise ValueError('Enter a valid phone number in international format')
    return f'+{digits}'


def normalize_identifier(value: str) -> str:
    candidate = value.strip()
    if not candidate:
        raise ValueError('Enter a phone number or username')
    phone = normalize_phone_number(candidate)
    return phone if phone is not None else candidate
