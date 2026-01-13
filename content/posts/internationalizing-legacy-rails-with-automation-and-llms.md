+++
date = '2026-01-13T00:00:00Z'
draft = false
title = 'Internationalizing Legacy Rails Apps with Automation and LLMs'
toc = true
+++

If you've ever inherited a Rails codebase with thousands of hardcoded strings scattered across views, controllers, and models, you know the dread. Internationalization (i18n) on a legacy system feels like archaeological work — except the artifacts are buried in ERB templates and the dig site spans hundreds of files.

I recently tackled this on a 10-year-old Rails monolith. Here's what I learned about using automation and LLMs to make the process less painful.

## The Reality of Legacy i18n

Rails has excellent i18n support built in. The problem is that it only works if someone actually uses it. Legacy codebases are riddled with:

```erb
<%# The classics %>
<h1>Welcome to our platform!</h1>
<p>You have <%= @count %> new messages</p>
<%= link_to "Click here to continue", dashboard_path %>
```

Multiply this by a few thousand files, add some strings hidden in helpers, mailers, and JavaScript, and you've got yourself a project.

The naive approach — manually grep for strings and replace them one by one — doesn't scale. You need automation.

## Essential Gems for the Job

### i18n-tasks: Your New Best Friend

The [i18n-tasks](https://github.com/glebm/i18n-tasks) gem is indispensable. It scans your codebase, finds missing translations, detects unused keys, and helps maintain consistency.

```ruby
# Gemfile
gem 'i18n-tasks', '~> 1.0'
```

After installation, run the health check:

```bash
$ bundle exec i18n-tasks health

Forest  Pair:  en ⇌ es
    ✓   0  keys have no base value
    !  42  keys missing from es
    !  12  keys unused
```

The `missing` command shows exactly what needs translation:

```bash
$ bundle exec i18n-tasks missing es

es:
  users:
    show:
      title: missing
      welcome_message: missing
  orders:
    confirmation:
      thank_you: missing
```

You can even auto-generate placeholder translations:

```bash
$ bundle exec i18n-tasks translate-missing es --backend=google
```

### i18n-debug: Finding the Culprits

When you're hunting down where strings come from, [i18n-debug](https://github.com/fphilipe/i18n-debug) shows you exactly which translation keys are being looked up:

```ruby
# Gemfile (development only)
gem 'i18n-debug', group: :development
```

Now your logs show:

```
  i18n-debug: users.show.title => "User Profile"
  i18n-debug: common.buttons.save => "Save Changes"
```

### rails-i18n: Don't Reinvent the Wheel

The [rails-i18n](https://github.com/svenfuchs/rails-i18n) gem provides translations for Rails defaults (validation messages, date formats, etc.) in over 100 languages:

```ruby
# Gemfile
gem 'rails-i18n', '~> 7.0'
```

This saves you from translating things like "can't be blank" yourself.

## Automating String Extraction

Here's where it gets interesting. Manually finding hardcoded strings is tedious. Let's automate it.

### Custom Rake Task for Detection

I wrote a rake task that scans ERB files for likely hardcoded strings:

```ruby
# lib/tasks/i18n_audit.rake
namespace :i18n do
  desc "Find hardcoded strings in views"
  task audit_views: :environment do
    require 'erb'

    hardcoded_pattern = />([A-Z][^<>{}#]*[a-z])</
    results = []

    Dir.glob(Rails.root.join('app/views/**/*.erb')).each do |file|
      content = File.read(file)

      content.scan(hardcoded_pattern).each do |match|
        text = match[0].strip
        next if text.length < 3
        next if text.match?(/^<%/)

        line_num = content[0..content.index(text)].count("\n") + 1
        results << {
          file: file.sub(Rails.root.to_s + '/', ''),
          line: line_num,
          text: text.truncate(60)
        }
      end
    end

    results.group_by { |r| r[:file] }.each do |file, matches|
      puts "\n#{file}:"
      matches.each { |m| puts "  L#{m[:line]}: #{m[:text]}" }
    end

    puts "\nTotal: #{results.count} potential hardcoded strings"
  end
end
```

Run it:

```bash
$ bundle exec rake i18n:audit_views

app/views/users/show.html.erb:
  L3: Welcome back!
  L15: Your account settings
  L23: Click here to upgrade

app/views/orders/index.html.erb:
  L7: Recent Orders
  L12: No orders found

Total: 847 potential hardcoded strings
```

847 strings. Fun times.

### AST-Based Extraction with Parser

For Ruby files (controllers, models, helpers), regex isn't reliable enough. Use the `parser` gem to work with the actual AST:

```ruby
# lib/i18n_string_finder.rb
require 'parser/current'

class I18nStringFinder < Parser::AST::Processor
  attr_reader :strings

  def initialize
    @strings = []
  end

  def on_str(node)
    value = node.children[0]

    # Skip short strings, paths, and technical values
    return if value.length < 4
    return if value.match?(%r{^[/\.]|^\w+$|^https?://})

    # Likely user-facing if it has spaces and capital letters
    if value.match?(/[A-Z].*\s/) || value.match?(/\s.*[A-Z]/)
      @strings << {
        text: value,
        location: node.location.expression
      }
    end
  end
end

# Usage
finder = I18nStringFinder.new
ast = Parser::CurrentRuby.parse(File.read('app/controllers/users_controller.rb'))
finder.process(ast)
finder.strings.each { |s| puts s[:text] }
```

## Enter the LLMs

This is where things get genuinely exciting. LLMs can help with several tedious parts of i18n work.

### Generating Translation Keys

Coming up with good, consistent key names is surprisingly time-consuming. Here's a script that uses an LLM to suggest keys:

```ruby
# lib/tasks/i18n_keygen.rake
require 'anthropic'

namespace :i18n do
  desc "Generate i18n keys for hardcoded strings"
  task generate_keys: :environment do
    client = Anthropic::Client.new

    strings = [
      { file: 'users/show', text: 'Welcome back!' },
      { file: 'users/show', text: 'Your account is pending approval' },
      { file: 'orders/index', text: 'No orders found' }
    ]

    prompt = <<~PROMPT
      Generate Rails i18n keys for these strings. Use the file path as context.
      Follow Rails conventions: lowercase, underscored, nested by feature.
      Return as YAML.

      Strings:
      #{strings.map { |s| "- File: #{s[:file]}, Text: \"#{s[:text]}\"" }.join("\n")}
    PROMPT

    response = client.messages.create(
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    )

    puts response.content[0].text
  end
end
```

Output:

```yaml
en:
  users:
    show:
      welcome_back: "Welcome back!"
      account_pending_approval: "Your account is pending approval"
  orders:
    index:
      no_orders_found: "No orders found"
```

### Bulk Translation with Context

Machine translation is decent for getting a first pass, but LLMs can do better because they understand context:

```ruby
# lib/translation_service.rb
class TranslationService
  def initialize
    @client = Anthropic::Client.new
  end

  def translate_batch(strings, from:, to:, context: nil)
    prompt = <<~PROMPT
      Translate these UI strings from #{from} to #{to}.
      This is for a #{context || 'web application'}.
      Preserve any interpolation variables like %{name} or %{count}.
      Keep translations concise and natural for UI elements.
      Return as JSON: {"original": "translation"}

      Strings:
      #{strings.map { |s| "- #{s}" }.join("\n")}
    PROMPT

    response = @client.messages.create(
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    )

    JSON.parse(response.content[0].text)
  end
end

# Usage
service = TranslationService.new
translations = service.translate_batch(
  [
    "Welcome back, %{name}!",
    "You have %{count} unread messages",
    "Your session will expire in %{minutes} minutes"
  ],
  from: 'English',
  to: 'Spanish',
  context: 'e-commerce platform'
)

# => {
#   "Welcome back, %{name}!" => "¡Bienvenido de nuevo, %{name}!",
#   "You have %{count} unread messages" => "Tienes %{count} mensajes sin leer",
#   "Your session will expire in %{minutes} minutes" => "Tu sesión expirará en %{minutes} minutos"
# }
```

### Code Transformation

The real power move is using LLMs to actually rewrite your code. Here's a script that transforms hardcoded strings into i18n calls:

```ruby
# lib/tasks/i18n_transform.rake
namespace :i18n do
  desc "Transform a view file to use i18n"
  task :transform_view, [:file] => :environment do |_, args|
    client = Anthropic::Client.new
    file_path = args[:file]
    content = File.read(Rails.root.join(file_path))

    # Derive the i18n scope from file path
    # app/views/users/show.html.erb -> users.show
    scope = file_path
      .sub('app/views/', '')
      .sub(/\.html\.erb$/, '')
      .gsub('/', '.')

    prompt = <<~PROMPT
      Transform this ERB template to use Rails i18n.

      Rules:
      1. Replace hardcoded user-facing strings with t() calls
      2. Use the scope '#{scope}' as the base
      3. Generate appropriate key names
      4. Preserve all Ruby/ERB logic exactly
      5. Handle pluralization with count: when appropriate
      6. Don't change technical strings (CSS classes, data attributes, etc.)

      Return two things:
      1. The transformed ERB template
      2. The YAML for the new translation keys

      Original template:
      ```erb
      #{content}
      ```
    PROMPT

    response = client.messages.create(
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    )

    puts response.content[0].text
  end
end
```

Input:

```erb
<div class="user-profile">
  <h1>User Profile</h1>
  <p>Welcome back, <%= @user.name %>!</p>

  <% if @user.messages.any? %>
    <p>You have <%= @user.messages.count %> new messages</p>
  <% else %>
    <p>No new messages</p>
  <% end %>

  <%= link_to "Edit Profile", edit_user_path(@user), class: "btn" %>
</div>
```

Output:

```erb
<div class="user-profile">
  <h1><%= t('.title') %></h1>
  <p><%= t('.welcome_back', name: @user.name) %></p>

  <% if @user.messages.any? %>
    <p><%= t('.new_messages', count: @user.messages.count) %></p>
  <% else %>
    <p><%= t('.no_messages') %></p>
  <% end %>

  <%= link_to t('.edit_profile'), edit_user_path(@user), class: "btn" %>
</div>
```

```yaml
en:
  users:
    show:
      title: "User Profile"
      welcome_back: "Welcome back, %{name}!"
      new_messages:
        one: "You have 1 new message"
        other: "You have %{count} new messages"
      no_messages: "No new messages"
      edit_profile: "Edit Profile"
```

## Strategies for Large Systems

After doing this on a large codebase, here's my advice:

### 1. Don't Boil the Ocean

Start with high-traffic pages. Use your analytics to identify the top 20 pages and internationalize those first. You'll cover 80% of user interactions with 20% of the work.

### 2. Create a Living Style Guide

Document your key naming conventions early:

```yaml
# Key naming conventions:
# - titles: Page titles and section headers
# - labels: Form labels
# - buttons: Button text
# - messages: Flash messages and notifications
# - errors: Error messages (beyond ActiveModel)
# - hints: Helper text and tooltips

en:
  users:
    new:
      title: "Create Account"
      labels:
        email: "Email Address"
        password: "Password"
      buttons:
        submit: "Sign Up"
      hints:
        password: "Must be at least 8 characters"
```

### 3. Automate the Review Process

Set up CI to catch i18n issues:

```yaml
# .github/workflows/i18n.yml
name: I18n Health Check

on: [push, pull_request]

jobs:
  i18n:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          bundler-cache: true

      - name: Check for missing translations
        run: |
          bundle exec i18n-tasks missing --strict

      - name: Check for unused translations
        run: |
          bundle exec i18n-tasks unused --strict

      - name: Normalize translation files
        run: |
          bundle exec i18n-tasks normalize
          git diff --exit-code config/locales/
```

### 4. Handle JavaScript Too

Don't forget your frontend. The [i18n-js](https://github.com/fnando/i18n-js) gem exports your Rails translations to JavaScript:

```ruby
# Gemfile
gem 'i18n-js', '~> 4.0'
```

```javascript
// In your JavaScript
import { I18n } from 'i18n-js';
import translations from './translations.json';

const i18n = new I18n(translations);
i18n.locale = document.documentElement.lang;

// Usage
i18n.t('users.show.welcome_back', { name: 'Alice' });
```

### 5. Set Up Translation Management

For ongoing translation work, consider a translation management system like [Lokalise](https://lokalise.com/), [Phrase](https://phrase.com/), or [Crowdin](https://crowdin.com/). They integrate with Rails and provide:

- Translator-friendly interfaces
- Translation memory
- Screenshot context
- Over-the-air updates

## Wrapping Up

Internationalizing a legacy Rails app is a marathon, not a sprint. But with the right tools, it's manageable:

1. **i18n-tasks** for auditing and maintaining translations
2. **Custom rake tasks** for finding hardcoded strings
3. **LLMs** for generating keys, translations, and even code transformations
4. **CI checks** to prevent regression
5. **Incremental approach** starting with high-impact pages

The combination of traditional tooling and LLMs is powerful. The gems handle the mechanical work of tracking translations, while LLMs help with the creative work of naming keys and understanding context.

Is it perfect? No. You'll still need human review, especially for nuanced translations. But you can turn a multi-month project into a few weeks of focused work.

The codebase I worked on went from 0% to 85% internationalized in about three weeks. The remaining 15% is the long tail of edge cases that's genuinely easier to do by hand.

If you're staring down a similar project, I hope this helps. The tools are better than ever, and the LLM-assisted workflow is a game changer.
