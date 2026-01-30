from playwright.sync_api import Page, expect, sync_playwright
import os

def test_limited_list(page: Page):
    url = "http://localhost:3000/stable/tool_quality/HAMMER"
    print(f"Navigating to {url}")
    page.goto(url)

    print("Waiting for page load...")
    page.wait_for_selector("h1")
    page.wait_for_timeout(3000)

    os.makedirs("/home/jules/verification", exist_ok=True)

    # Find all disclosure buttons
    buttons = page.locator("button.disclosure")
    count = buttons.count()
    print(f"Found {count} disclosure buttons.")

    if count == 0:
        print("No buttons found.")
        return

    # Use the first button
    button = buttons.first

    print("Scrolling to button...")
    button.scroll_into_view_if_needed()

    # Get initial text to be sure
    initial_text = button.text_content()
    print(f"Initial text: {initial_text}")

    if "See all" not in initial_text:
        print("Button is not in 'See all' state. Maybe already expanded?")
        # If it says "Show less", click to collapse first?
        if "Show less" in initial_text:
            button.click()
            page.wait_for_timeout(500)

    # Check aria-expanded is false
    print("Checking aria-expanded=false")
    expect(button).to_have_attribute("aria-expanded", "false")

    # Screenshot before
    page.screenshot(path="/home/jules/verification/before_click.png")

    # Click it
    print("Clicking button")
    button.click()

    # Check text changes to "Show less"
    # We use the same locator `buttons.first` which is just `.disclosure`.
    # It should now point to the same element but with new text.
    print("Checking for 'Show less'")
    expect(button).to_have_text("Show less")

    # Check aria-expanded is true
    print("Checking aria-expanded=true")
    expect(button).to_have_attribute("aria-expanded", "true")

    # Screenshot
    page.screenshot(path="/home/jules/verification/verification.png")
    print("Verification successful!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            test_limited_list(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
        finally:
            context.close()
            browser.close()
