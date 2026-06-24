using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class ListCoursesExample {
    public static async Task ListCourses() {
        using (var client = new HttpClient()) {
            client.BaseAddress = new Uri("http://localhost:3000");
            
            var response = await client.getAsync("/courses");
            
            var result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response: " + result);
        }
    }

    public static void Main() {
        ListCourses().Wait();
    }
}