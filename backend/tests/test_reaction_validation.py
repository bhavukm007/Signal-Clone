import pytest
from pydantic import ValidationError

from app.schemas.message import ReactionInput


@pytest.mark.parametrize('emoji', ['👍', '❤️', '👍🏽', '🇮🇳', '1️⃣', '☀️'])
def test_reaction_accepts_one_emoji_grapheme(emoji: str) -> None:
    assert ReactionInput(emoji=emoji).emoji == emoji


@pytest.mark.parametrize('emoji', ['', 'ab', '👍👍', '❤️❤️', '👍 x', '🏽', 'A', '👩‍🚀🌕'])
def test_reaction_rejects_non_emoji_or_multiple_graphemes(emoji: str) -> None:
    with pytest.raises(ValidationError):
        ReactionInput(emoji=emoji)


def test_reaction_rejects_over_16_utf8_bytes() -> None:
    with pytest.raises(ValidationError):
        ReactionInput(emoji='👨‍👩‍👧‍👦')
