function handleSignup(event) {
      event.preventDefault();
      
      const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        operation: document.getElementById('operation').value,
        properties: document.getElementById('properties').value,
        contractors: document.getElementById('contractors').value,
        timestamp: new Date().toISOString()
      };
      
      console.log('Early Access Signup:', formData);
      
      alert('Thank you for signing up! We will contact you within 24 hours at ' + formData.email + ' to schedule your free pilot.');
      
      event.target.reset();
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });