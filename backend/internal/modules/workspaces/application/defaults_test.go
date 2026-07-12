package application

import "testing"

func TestDefaultWorkspaceCatalogue(t *testing.T) {
	channels := DefaultWorkspaceChannels()
	if len(channels) != 9 {
		t.Fatalf("len(DefaultWorkspaceChannels()) = %d, want 9", len(channels))
	}

	channelSlugs := make(map[string]bool, len(channels))
	for _, channel := range channels {
		if channel.Slug == "" || channel.Name == "" || (channel.Type != "public" && channel.Type != "private") || channelSlugs[channel.Slug] {
			t.Fatalf("default channel không hợp lệ hoặc bị trùng: %#v", channel)
		}
		channelSlugs[channel.Slug] = true
	}

	bots := DefaultWorkspaceBots()
	if len(bots) != 5 {
		t.Fatalf("len(DefaultWorkspaceBots()) = %d, want 5", len(bots))
	}
	botSlugs := make(map[string]bool, len(bots))
	for _, bot := range bots {
		if bot.Slug == "" || bot.Name == "" || botSlugs[bot.Slug] {
			t.Fatalf("default bot không hợp lệ hoặc bị trùng: %#v", bot)
		}
		if !channelSlugs[bot.ChannelSlug] {
			t.Fatalf("bot %q tham chiếu channel không tồn tại %q", bot.Slug, bot.ChannelSlug)
		}
		botSlugs[bot.Slug] = true
	}
}
